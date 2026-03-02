// src/auth/auth.service.ts
import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
  NotFoundException,
  InternalServerErrorException,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import * as bcrypt from "bcrypt";
import * as crypto from "crypto";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
import { VerifyOtpDto } from "./dto/verify-otp.dto";
import { ResendOtpDto } from "./dto/resend-otp.dto";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { User, Prisma, OtpPurpose } from "@prisma/client";
import { Redis } from "ioredis";
import { PrismaService } from "src/prisma/prisma.service";

@Injectable()
export class AuthService {
  private redis: Redis;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService
  ) {
    this.redis = new Redis({
      host: this.configService.get("REDIS_HOST", "localhost"),
      port: this.configService.get("REDIS_PORT", 6379),
      password: this.configService.get("REDIS_PASSWORD"),
    });
  }

  async register(registerDto: RegisterDto) {
    const {
      email,
      password,
      full_name,
      phone,
      role,
      is_corporate,
      company_name,
      gst_number,
    } = registerDto;

    try {
      // Check if user already exists
      const existingUser = await this.prisma.user.findFirst({
        where: {
          OR: [{ email }, { phone }],
        },
      });

      if (existingUser) {
        if (existingUser.email === email) {
          throw new ConflictException("Email already registered");
        }
        if (existingUser.phone === phone) {
          throw new ConflictException("Phone number already registered");
        }
      }

      // Validate corporate user requirements
      if (is_corporate && !company_name) {
        throw new BadRequestException("Company name is required for corporate users");
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create user
      const user = await this.prisma.user.create({
        data: {
          email,
          passwordHash: hashedPassword,
          fullName: full_name,
          phone,
          role: role || "USER",
          isCorporate: is_corporate || false,
          companyName: company_name,
          gstNumber: gst_number,
          isVerified: false,
        },
        select: {
          id: true,
          email: true,
          fullName: true,
          phone: true,
          role: true,
          isCorporate: true,
          companyName: true,
          gstNumber: true,
          isVerified: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      // Generate and send OTP
      await this.generateAndSendOtp(email, phone, OtpPurpose.SIGNUP);

      // Generate tokens
      const tokens = await this.generateTokens(user.id, user.email);

      return {
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          phone: user.phone,
          role: user.role,
          isCorporate: user.isCorporate,
          companyName: user.companyName,
          gstNumber: user.gstNumber,
          isVerified: user.isVerified,
          isActive: user.isActive,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
      };
    } catch (error) {
      if (
        error instanceof ConflictException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new InternalServerErrorException("Failed to register user");
    }
  }

  async verifyOtp(verifyOtpDto: VerifyOtpDto) {
    const { identifier, otp, purpose } = verifyOtpDto;

    // Find OTP record
    const otpRecord = await this.prisma.otpVerification.findFirst({
      where: {
        identifier,
        purpose,
        isUsed: false,
        expiresAt: {
          gt: new Date(),
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (!otpRecord || otpRecord.otpCode !== otp) {
      throw new BadRequestException("Invalid or expired OTP");
    }

    // Mark OTP as used
    await this.prisma.otpVerification.update({
      where: { id: otpRecord.id },
      data: { isUsed: true },
    });

    // If SIGNUP purpose, mark user as verified
    if (purpose === OtpPurpose.SIGNUP) {
      const user = await this.prisma.user.findFirst({
        where: {
          OR: [{ email: identifier }, { phone: identifier }],
        },
      });

      if (user) {
        await this.prisma.user.update({
          where: { id: user.id },
          data: { isVerified: true },
        });
      }
    }

    return { message: "OTP verified successfully" };
  }

  async resendOtp(resendOtpDto: ResendOtpDto) {
    const { identifier, purpose } = resendOtpDto;

    // Rate limiting: max 3 per 10 minutes
    const rateLimitKey = `otp:resend:${identifier}:${purpose}`;
    const resendCount = await this.redis.get(rateLimitKey);
    
    if (resendCount && parseInt(resendCount) >= 3) {
      throw new HttpException(
        "Maximum OTP resend attempts reached. Please try again later.",
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    // Increment counter
    await this.redis.incr(rateLimitKey);
    await this.redis.expire(rateLimitKey, 600); // 10 minutes

    // Invalidate previous OTPs
    await this.prisma.otpVerification.updateMany({
      where: {
        identifier,
        purpose,
        isUsed: false,
      },
      data: {
        isUsed: true,
      },
    });

    // Find user to get email/phone
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: identifier }, { phone: identifier }],
      },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    // Generate and send new OTP
    await this.generateAndSendOtp(user.email, user.phone, purpose);

    return { message: "OTP sent successfully" };
  }

  async login(loginDto: LoginDto) {
    const { email, password, device_info } = loginDto;

    // Find user
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException("Invalid credentials");
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException("Invalid credentials");
    }

    // Check if user is active
    if (!user.isActive) {
      throw new UnauthorizedException("Account is deactivated");
    }

    // Check if user is verified
    if (!user.isVerified) {
      throw new UnauthorizedException("Please verify your email/phone first");
    }

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Generate tokens
    const tokens = await this.generateTokens(user.id, user.email, device_info);

    return {
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        phone: user.phone,
        role: user.role,
        isCorporate: user.isCorporate,
        companyName: user.companyName,
        gstNumber: user.gstNumber,
        isVerified: user.isVerified,
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    };
  }

  async logout(userId: string, refreshToken: string) {
    // Revoke refresh token
    if (refreshToken) {
      await this.prisma.refreshToken.updateMany({
        where: {
          userId,
          token: refreshToken,
          isRevoked: false,
        },
        data: {
          isRevoked: true,
        },
      });
    }

    // Optionally revoke all tokens
    // await this.prisma.refreshToken.updateMany({
    //   where: { userId, isRevoked: false },
    //   data: { isRevoked: true },
    // });

    return { message: "Logged out successfully" };
  }

  async refreshToken(refreshTokenDto: RefreshTokenDto) {
    const { refresh_token } = refreshTokenDto;

    try {
      // Verify refresh token
      const payload = this.jwtService.verify(refresh_token, {
        secret: this.configService.get("JWT_REFRESH_SECRET"),
      });

      // Check if refresh token exists and is not revoked
      const tokenRecord = await this.prisma.refreshToken.findFirst({
        where: {
          userId: payload.sub,
          token: refresh_token,
          isRevoked: false,
          expiresAt: {
            gt: new Date(),
          },
        },
      });

      if (!tokenRecord) {
        throw new UnauthorizedException("Invalid or expired refresh token");
      }

      // Get user
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user || !user.isActive) {
        throw new UnauthorizedException("User not found or inactive");
      }

      // Revoke old refresh token (rotation)
      await this.prisma.refreshToken.update({
        where: { id: tokenRecord.id },
        data: { isRevoked: true },
      });

      // Generate new tokens
      const tokens = await this.generateTokens(
        user.id,
        user.email,
        tokenRecord.deviceInfo || undefined
      );

      return {
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          phone: user.phone,
          role: user.role,
          isCorporate: user.isCorporate,
          companyName: user.companyName,
          gstNumber: user.gstNumber,
          isVerified: user.isVerified,
          isActive: user.isActive,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
      };
    } catch (error) {
      throw new UnauthorizedException("Invalid refresh token");
    }
  }

  async forgotPassword(forgotPasswordDto: ForgotPasswordDto) {
    const { email } = forgotPasswordDto;

    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Don't reveal if email exists
      return { message: "If the email exists, a reset OTP has been sent" };
    }

    // Generate and send password reset OTP
    await this.generateAndSendOtp(email, user.phone, OtpPurpose.PASSWORD_RESET);

    return { message: "If the email exists, a reset OTP has been sent" };
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    const { email, otp, new_password } = resetPasswordDto;

    // Verify OTP
    const otpRecord = await this.prisma.otpVerification.findFirst({
      where: {
        identifier: email,
        purpose: OtpPurpose.PASSWORD_RESET,
        otpCode: otp,
        isUsed: false,
        expiresAt: {
          gt: new Date(),
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (!otpRecord) {
      throw new BadRequestException("Invalid or expired OTP");
    }

    // Get user
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(new_password, 10);

    // Update password
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: hashedPassword },
    });

    // Mark OTP as used
    await this.prisma.otpVerification.update({
      where: { id: otpRecord.id },
      data: { isUsed: true },
    });

    // Revoke all existing refresh tokens
    await this.prisma.refreshToken.updateMany({
      where: {
        userId: user.id,
        isRevoked: false,
      },
      data: {
        isRevoked: true,
      },
    });

    return { message: "Password reset successfully" };
  }

  async changePassword(userId: string, changePasswordDto: ChangePasswordDto) {
    const { currentPassword: current_password, newPassword: new_password } = changePasswordDto;

    // Get user
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(
      current_password,
      user.passwordHash
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException("Current password is incorrect");
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(new_password, 10);

    // Update password
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: hashedPassword },
    });

    // Optionally revoke other sessions
    // await this.prisma.refreshToken.updateMany({
    //   where: {
    //     userId,
    //     isRevoked: false,
    //   },
    //   data: {
    //     isRevoked: true,
    //   },
    // });

    return { message: "Password changed successfully" };
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        addresses: {
          orderBy: { isDefault: "desc" },
        },
        nursery: true,
        gardener: true,
      },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    const { passwordHash, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async getSessions(userId: string) {
    const sessions = await this.prisma.refreshToken.findMany({
      where: {
        userId,
        isRevoked: false,
        expiresAt: {
          gt: new Date(),
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        deviceInfo: true,
        createdAt: true,
        expiresAt: true,
        isRevoked: true,
      },
    });

    return sessions;
  }

  async revokeSession(userId: string, sessionId: string) {
    const session = await this.prisma.refreshToken.findFirst({
      where: {
        id: sessionId,
        userId,
      },
    });

    if (!session) {
      throw new NotFoundException("Session not found");
    }

    await this.prisma.refreshToken.update({
      where: { id: sessionId },
      data: { isRevoked: true },
    });

    return { message: "Session revoked successfully" };
  }

  // Helper methods
  private async generateTokens(
    userId: string,
    email: string,
    deviceInfo?: string
  ) {
    const payload = { sub: userId, email };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get("JWT_SECRET"),
      expiresIn: "15m",
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get("JWT_REFRESH_SECRET"),
      expiresIn: "30d",
    });

    // Store refresh token in database
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days

    await this.prisma.refreshToken.create({
      data: {
        userId,
        token: refreshToken,
        deviceInfo,
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken,
    };
  }

  private async generateAndSendOtp(
    email: string,
    phone: string | null,
    purpose: OtpPurpose
  ) {
    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Calculate expiry (5 minutes)
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 5);

    // Store OTP in database
    const identifiers = [email];
    if (phone) {
      identifiers.push(phone);
    }
    for (const identifier of identifiers) {
      await this.prisma.otpVerification.create({
        data: {
          identifier,
          otpCode: otp,
          purpose,
          expiresAt,
        },
      });
    }

    // Send OTP via email/SMS
    // await this.emailService.sendOtp(email, otp, purpose);
    // if (phone) {
    //   await this.smsService.sendOtp(phone, otp, purpose);
    // }

    return otp;
  }

  async validateUser(userId: string): Promise<User> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException("User not found or inactive");
    }

    return user;
  }

  async isTokenBlacklisted(token: string): Promise<boolean> {
    const result = await this.redis.get(`blacklist:${token}`);
    return !!result;
  }
}

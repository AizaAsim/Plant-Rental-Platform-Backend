// src/auth/auth.controller.ts
import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Headers,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiHeader,
  ApiParam,
} from "@nestjs/swagger";
import { AuthService } from "./auth.service";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
import { VerifyOtpDto } from "./dto/verify-otp.dto";
import { ResendOtpDto } from "./dto/resend-otp.dto";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { AuthResponseDto, MessageResponseDto } from "./dto/auth-response.dto";
import { SessionResponseDto } from "./dto/sessions.dto";
import { JwtAuthGuard } from "./guard/jwt-auth.guard";

@ApiTags("Authentication")
@Controller("api/v1/auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("register")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Register a new user account" })
  @ApiResponse({
    status: 201,
    description: "User registered successfully",
    type: AuthResponseDto,
  })
  @ApiResponse({ status: 409, description: "Email or phone already exists" })
  async register(@Body() registerDto: RegisterDto): Promise<AuthResponseDto> {
    return this.authService.register(registerDto);
  }

  @Post("verify-otp")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Verify OTP for email/phone verification" })
  @ApiResponse({
    status: 200,
    description: "OTP verified successfully",
    type: MessageResponseDto,
  })
  @ApiResponse({ status: 400, description: "Invalid or expired OTP" })
  async verifyOtp(@Body() verifyOtpDto: VerifyOtpDto): Promise<MessageResponseDto> {
    return this.authService.verifyOtp(verifyOtpDto);
  }

  @Post("resend-otp")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Resend OTP to user" })
  @ApiResponse({
    status: 200,
    description: "OTP sent successfully",
    type: MessageResponseDto,
  })
  @ApiResponse({ status: 429, description: "Too many requests" })
  async resendOtp(@Body() resendOtpDto: ResendOtpDto): Promise<MessageResponseDto> {
    return this.authService.resendOtp(resendOtpDto);
  }

  @Post("login")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Authenticate user and get tokens" })
  @ApiResponse({
    status: 200,
    description: "User logged in successfully",
    type: AuthResponseDto,
  })
  @ApiResponse({ status: 401, description: "Invalid credentials" })
  async login(@Body() loginDto: LoginDto): Promise<AuthResponseDto> {
    return this.authService.login(loginDto);
  }

  @Post("logout")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: "Logout user and invalidate tokens" })
  @ApiResponse({
    status: 200,
    description: "User logged out successfully",
    type: MessageResponseDto,
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async logout(
    @Request() req,
    @Body() body: { refresh_token: string }
  ): Promise<MessageResponseDto> {
    return this.authService.logout(req.user.id, body.refresh_token);
  }

  @Post("refresh-token")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Get new access token using refresh token" })
  @ApiResponse({
    status: 200,
    description: "Token refreshed successfully",
    type: AuthResponseDto,
  })
  @ApiResponse({ status: 401, description: "Invalid refresh token" })
  async refreshToken(
    @Body() refreshTokenDto: RefreshTokenDto
  ): Promise<AuthResponseDto> {
    return this.authService.refreshToken(refreshTokenDto);
  }

  @Post("forgot-password")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Initiate password reset process" })
  @ApiResponse({
    status: 200,
    description: "Password reset OTP sent",
    type: MessageResponseDto,
  })
  async forgotPassword(
    @Body() forgotPasswordDto: ForgotPasswordDto
  ): Promise<MessageResponseDto> {
    return this.authService.forgotPassword(forgotPasswordDto);
  }

  @Post("reset-password")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Reset password with OTP" })
  @ApiResponse({
    status: 200,
    description: "Password reset successfully",
    type: MessageResponseDto,
  })
  @ApiResponse({ status: 400, description: "Invalid or expired OTP" })
  async resetPassword(
    @Body() resetPasswordDto: ResetPasswordDto
  ): Promise<MessageResponseDto> {
    return this.authService.resetPassword(resetPasswordDto);
  }

  @Put("change-password")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: "Change password for authenticated user" })
  @ApiResponse({
    status: 200,
    description: "Password changed successfully",
    type: MessageResponseDto,
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async changePassword(
    @Request() req,
    @Body() changePasswordDto: ChangePasswordDto
  ): Promise<MessageResponseDto> {
    return this.authService.changePassword(req.user.id, changePasswordDto);
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: "Get current authenticated user profile" })
  @ApiResponse({
    status: 200,
    description: "User profile retrieved successfully",
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async getMe(@Request() req) {
    return this.authService.getMe(req.user.id);
  }

  @Get("sessions")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: "Get all active sessions for user" })
  @ApiResponse({
    status: 200,
    description: "Sessions retrieved successfully",
    type: [SessionResponseDto],
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async getSessions(@Request() req): Promise<SessionResponseDto[]> {
    return this.authService.getSessions(req.user.id);
  }

  @Delete("sessions/:session_id")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: "Revoke specific session" })
  @ApiParam({ name: "session_id", description: "Session ID" })
  @ApiResponse({
    status: 200,
    description: "Session revoked successfully",
    type: MessageResponseDto,
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 404, description: "Session not found" })
  async revokeSession(
    @Request() req,
    @Param("session_id") sessionId: string
  ): Promise<MessageResponseDto> {
    return this.authService.revokeSession(req.user.id, sessionId);
  }
}

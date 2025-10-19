import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsOptional,
  IsString,
  IsEnum,
  IsNumber,
  Min,
  Max,
} from "class-validator";

export enum NotificationChannel {
  EMAIL = "EMAIL",
  SMS = "SMS",
  PUSH = "PUSH",
  IN_APP = "IN_APP",
}

export enum Language {
  EN = "en",
  UR = "ur",
  AR = "ar",
}

export enum Theme {
  LIGHT = "light",
  DARK = "dark",
  AUTO = "auto",
}

export class UpdatePreferencesDto {
  @ApiPropertyOptional({
    example: true,
    description: "Receive email notifications",
  })
  @IsOptional()
  @IsBoolean()
  emailNotifications?: boolean;

  @ApiPropertyOptional({
    example: false,
    description: "Receive SMS notifications",
  })
  @IsOptional()
  @IsBoolean()
  smsNotifications?: boolean;

  @ApiPropertyOptional({
    example: true,
    description: "Receive push notifications",
  })
  @IsOptional()
  @IsBoolean()
  pushNotifications?: boolean;

  @ApiPropertyOptional({
    example: true,
    description: "Receive marketing communications",
  })
  @IsOptional()
  @IsBoolean()
  marketingEmails?: boolean;

  @ApiPropertyOptional({
    example: true,
    description: "Receive rental reminders",
  })
  @IsOptional()
  @IsBoolean()
  rentalReminders?: boolean;

  @ApiPropertyOptional({
    example: true,
    description: "Receive maintenance updates",
  })
  @IsOptional()
  @IsBoolean()
  maintenanceUpdates?: boolean;

  @ApiPropertyOptional({
    enum: Language,
    example: "en",
    description: "Preferred language",
  })
  @IsOptional()
  @IsEnum(Language)
  language?: Language;

  @ApiPropertyOptional({
    enum: Theme,
    example: "light",
    description: "Preferred theme",
  })
  @IsOptional()
  @IsEnum(Theme)
  theme?: Theme;

  @ApiPropertyOptional({
    example: "PKR",
    description: "Preferred currency",
  })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({
    example: 10,
    description: "Default delivery radius in km",
    minimum: 1,
    maximum: 50,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(50)
  defaultDeliveryRadius?: number;

  @ApiPropertyOptional({
    example: ["INDOOR", "SUCCULENTS"],
    description: "Preferred plant categories",
    type: [String],
  })
  @IsOptional()
  preferredCategories?: string[];
}

export class PreferencesResponseDto {
  @ApiProperty({ example: "clh1234567890abcdef" })
  userId: string;

  @ApiProperty({ example: true })
  emailNotifications: boolean;

  @ApiProperty({ example: false })
  smsNotifications: boolean;

  @ApiProperty({ example: true })
  pushNotifications: boolean;

  @ApiProperty({ example: true })
  marketingEmails: boolean;

  @ApiProperty({ example: true })
  rentalReminders: boolean;

  @ApiProperty({ example: true })
  maintenanceUpdates: boolean;

  @ApiProperty({ example: "en" })
  language: string;

  @ApiProperty({ example: "light" })
  theme: string;

  @ApiProperty({ example: "PKR" })
  currency: string;

  @ApiProperty({ example: 10 })
  defaultDeliveryRadius: number;

  @ApiProperty({ example: ["INDOOR", "SUCCULENTS"] })
  preferredCategories: string[];

  @ApiProperty({ example: "2024-01-01T00:00:00.000Z" })
  createdAt: Date;

  @ApiProperty({ example: "2024-01-01T00:00:00.000Z" })
  updatedAt: Date;
}

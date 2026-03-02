import { ApiProperty } from "@nestjs/swagger";

export class SessionResponseDto {
  @ApiProperty({ example: "clh1234567890abcdef" })
  id: string;

  @ApiProperty({ example: "iPhone 14 Pro" })
  deviceInfo?: string;

  @ApiProperty({ example: "2024-01-01T00:00:00.000Z" })
  createdAt: Date;

  @ApiProperty({ example: "2024-01-15T00:00:00.000Z" })
  expiresAt: Date;

  @ApiProperty({ example: false })
  isRevoked: boolean;
}

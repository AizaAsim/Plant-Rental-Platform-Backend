import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { NotificationType } from "@prisma/client";

export class NotificationDto {
  @ApiProperty({ example: "clh1234567890abcdef" })
  id: string;

  @ApiProperty({ example: "Order Confirmed" })
  title: string;

  @ApiProperty({ example: "Your order #12345 has been confirmed" })
  message: string;

  @ApiProperty({ enum: NotificationType })
  type: NotificationType;

  @ApiPropertyOptional({ example: "Order" })
  referenceType?: string;

  @ApiPropertyOptional({ example: "clh1234567890abcdef" })
  referenceId?: string;

  @ApiProperty({ example: false })
  isRead: boolean;

  @ApiPropertyOptional({ example: "2024-01-01T00:00:00.000Z" })
  readAt?: Date;

  @ApiProperty({ example: "2024-01-01T00:00:00.000Z" })
  createdAt: Date;
}

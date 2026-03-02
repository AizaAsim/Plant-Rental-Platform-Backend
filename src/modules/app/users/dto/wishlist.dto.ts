import { ApiProperty } from "@nestjs/swagger";

export class WishlistItemDto {
  @ApiProperty({ example: "clh1234567890abcdef" })
  id: string;

  @ApiProperty({ example: "clh1234567890abcdef" })
  plantId: string;

  @ApiProperty({ example: "2024-01-01T00:00:00.000Z" })
  createdAt: Date;

  @ApiProperty()
  plant: any; // Plant details
}

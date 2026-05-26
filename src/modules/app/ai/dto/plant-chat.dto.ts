import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";

/** Body for POST /api/v1/ai/recommender/chat (proxies upstream POST /chat). */
export class PlantChatDto {
  @ApiProperty({
    example: "What low-light plants are safe for cats?",
    description: "User message sent to the Plant RAG chatbot",
  })
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  message: string;

  @ApiPropertyOptional({
    description: "If true, also match mentioned plants against the active catalogue",
    default: true,
  })
  @IsOptional()
  include_catalog_matches?: boolean;
}

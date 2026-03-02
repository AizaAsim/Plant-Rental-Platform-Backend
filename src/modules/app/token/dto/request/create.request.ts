import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsInt, IsUUID } from 'class-validator';

export default class CreatePasswordTokenRequestDTO {
    @ApiProperty({ example: 'PASSWORD_RESET' })
    @IsString()
    reason: string;

    @ApiProperty()
    @IsUUID('4')
    uuid: string;

    @ApiProperty()
    @IsInt()
    userId: number;
}

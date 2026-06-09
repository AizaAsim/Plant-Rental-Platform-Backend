import { PartialType } from "@nestjs/swagger";
import { CreateNurseryDto } from "./create-nursery.dto";

/** All fields optional — used by PUT /api/v1/nurseries/my-nursery */
export class UpdateNurseryDto extends PartialType(CreateNurseryDto) {}

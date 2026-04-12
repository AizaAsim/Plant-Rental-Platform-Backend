import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Param,
  Post,
  Query,
  Request,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor, FilesInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { MediaService } from "./media.service";
import { JwtAuthGuard } from "../auth/guard/jwt-auth.guard";

const imageFileFilter = (
  _req: Express.Request,
  file: { mimetype: string },
  cb: (error: Error | null, acceptFile: boolean) => void
) => {
  if (!file.mimetype?.startsWith("image/")) {
    return cb(new BadRequestException("Only image files are allowed"), false);
  }
  cb(null, true);
};

const multerOpts = {
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: imageFileFilter,
};

@ApiTags("Media")
@Controller("api/v1/media")
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post("upload")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @UseInterceptors(FileInterceptor("file", multerOpts))
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        file: { type: "string", format: "binary" },
      },
    },
  })
  @ApiQuery({ name: "folder", required: false })
  @ApiQuery({ name: "resize", required: false })
  @ApiOperation({ summary: "Upload single image" })
  async upload(
    @Request() req,
    @UploadedFile() file: { buffer: Buffer; mimetype: string; size: number } | undefined,
    @Query("folder") folder?: string,
    @Query("resize") resize?: string
  ) {
    return this.mediaService.uploadFile(req.user.id, file, folder, resize);
  }

  @Post("upload/multiple")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @UseInterceptors(FilesInterceptor("files", 20, multerOpts))
  @ApiConsumes("multipart/form-data")
  @ApiOperation({ summary: "Upload multiple images" })
  @ApiQuery({ name: "folder", required: false })
  @ApiQuery({ name: "resize", required: false })
  async uploadMany(
    @Request() req,
    @UploadedFiles() files: { buffer: Buffer; mimetype: string; size: number }[],
    @Query("folder") folder?: string,
    @Query("resize") resize?: string
  ) {
    return this.mediaService.uploadMultiple(req.user.id, files, folder, resize);
  }

  @Post("presigned-url")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get presigned URL (S3) or mock URL" })
  async presigned(@Request() req, @Body() body: any) {
    return this.mediaService.presignedUpload(req.user.id, body);
  }

  @Delete(":key")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Delete file by storage key (encode slashes as %2F)" })
  async remove(@Request() req, @Param("key") key: string) {
    return this.mediaService.deleteMedia(req.user.id, req.user.role, decodeURIComponent(key));
  }
}

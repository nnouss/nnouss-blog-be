import {
    IsArray,
    IsEnum,
    IsNotEmpty,
    IsOptional,
    IsString,
} from 'class-validator';

export enum PostType {
    dev = 'dev',
    story = 'story',
}

export class CreatePostDto {
    @IsString()
    @IsNotEmpty()
    title!: string;

    @IsEnum(PostType)
    type!: PostType;

    @IsArray()
    @IsString({ each: true })
    tags!: string[];

    @IsString()
    @IsNotEmpty()
    content!: string;

    @IsString()
    @IsOptional()
    thumbnailUrl?: string | null;
}

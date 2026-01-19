import { IsOptional, IsString } from 'class-validator';

export class TrackDto {
    @IsOptional()
    @IsString()
    visitorId?: string;
}

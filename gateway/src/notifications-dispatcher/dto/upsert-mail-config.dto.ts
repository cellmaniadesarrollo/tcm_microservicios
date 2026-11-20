import { IsBoolean, IsEmail, IsIn, IsInt, IsOptional, IsString, Max, Min, MaxLength } from 'class-validator';

export class UpsertMailConfigDto {
    @IsIn(['GMAIL', 'SES', 'SMTP'])
    provider!: 'GMAIL' | 'SES' | 'SMTP';

    @IsOptional() @IsString() @MaxLength(150)
    host?: string | null;

    @IsOptional() @IsInt() @Min(1) @Max(65535)
    port?: number | null;

    @IsOptional() @IsBoolean()
    secure?: boolean | null;

    @IsString() @MaxLength(200)
    username!: string;

    /** Obligatoria la primera vez; opcional al actualizar (conserva la anterior). */
    @IsOptional() @IsString()
    password?: string;

    @IsEmail() @MaxLength(150)
    fromEmail!: string;

    @IsString() @MaxLength(100)
    fromName!: string;

    @IsOptional() @IsEmail() @MaxLength(150)
    replyTo?: string | null;

    @IsOptional() @IsBoolean()
    isActive?: boolean;
}
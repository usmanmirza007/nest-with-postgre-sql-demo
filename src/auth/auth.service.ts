import { ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthDto } from './dto';
import * as argon from 'argon2'
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthService {
    constructor(
        private prisma: PrismaService,
        private jwt: JwtService,
        private config: ConfigService
    ) { }
    async signup(dto: AuthDto) {
        try {

            const userExsit = await this.prisma.user.findUnique({
                where: {
                    email: dto.email
                }
            })
            if (userExsit && userExsit.email == dto.email) {
                throw new ConflictException('email already taken')
            }
            const hash = await argon.hash(dto.password)
            const user = await this.prisma.user.create({
                data: {
                    email: dto.email,
                    hash
                }
            })
            return this.signToken(user.id, user.email)

        } catch (error) {
            console.log('err auth', error);
            throw error
        }
    }

    async signin(dto: AuthDto) {
        const user = await this.prisma.user.findUnique({
            where: {
                email: dto.email
            }
        })

        if (!user) {
            throw new ForbiddenException('User not found')
        }

        const passwordMatch = await argon.verify(user.hash, dto.password)

        if (!passwordMatch) {
            throw new ForbiddenException('Credentials incorrect')
        }

        return this.signToken(user.id, user.email)

    }

    async signToken(userId: number, email: string): Promise<{ access_token: string }> {

        try {
            const payload = { sub: userId, email }
            const secret = this.config.get('JWT_SECRET')
            const token = await this.jwt.signAsync(payload, {
                expiresIn: '15m',
                secret: secret
            })

            return {
                access_token: token
            }
        } catch (error) {
            console.log('err', error);

        }

    }
}

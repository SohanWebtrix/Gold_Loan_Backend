/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/require-await */
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthRepository } from './auth.repository/auth.repository';


@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(config: ConfigService, private readonly Authrepo: AuthRepository,
    ) {
        super({
            jwtFromRequest: ExtractJwt.fromExtractors([
                ExtractJwt.fromAuthHeaderAsBearerToken(), // ✅ frontend
                (req) => req?.cookies?.access_token,
            ]),
            secretOrKey: config.getOrThrow<string>('JWT_SECRET'), //it checks the jwt_secret and is token modified , token expired ex. 
            passReqToCallback: true, // ✅ important

        });
    }

    async validate(req: any, payload: any) {

        const token =
            req.headers.authorization?.split(" ")[1] ||
            req.cookies?.access_token;

        // const isBlacklisted = await this.Authrepo.isTokenBlacklisted(token);

        // if (isBlacklisted) {
        //     throw new UnauthorizedException("Token expired");
        // }

        return {
            userId: payload.sub,
            email: payload.email,
        };
    }
}


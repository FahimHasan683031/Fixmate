import Redis from "ioredis"
import { redisConfig } from "../config/redis"

const redisClient = new Redis( redisConfig );

export const redisDB = {
    get: async ( key: string ) => {
        return await redisClient.get( key );
    },
    set: async ( key: string, value: string ) => {
        return await redisClient.set( key, value );
    },
    del: async ( key: string ) => {
        return await redisClient.del( key );
    }
}
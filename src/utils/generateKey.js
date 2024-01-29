import { customAlphabet } from 'nanoid';
import Link from '../models/link.model.js';

const nanoid = customAlphabet(
    '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
    7
);

export const getKey = async () => {
    const key = nanoid();
    const keyExist = await Link.findOne({ key });
    if (keyExist) {
        return getKey();
    }
    return key;
};

import Link from '../models/link.model.js';
import { ApiResponce } from '../utils/ApiResponce.js';
import { ApiError } from '../utils/ApiError.js';
import { getmetaData } from '../utils/getMetaData.js';
import User from '../models/user.model.js';
import Stats from '../models/stats.model.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import parseUserAgent from 'ua-parser-js';
import { getKey } from '../utils/generateKey.js';
import requestIp from 'request-ip';
import fetch from 'node-fetch';

const redirect = async (req, res) => {
    try {
        const { key } = req.params;
        const ipAddres = requestIp.getClientIp(req);
        const geoData = await fetch(
            `https://ipgeolocation.abstractapi.com/v1/?api_key=dc4ee8a608ca4d2cb87265f770a461dc&ip_address=${ipAddres}`
        );
        const { city, country, flag } = await geoData.json();
        if (!key) {
            return res.status(400).json(new ApiError(400, 'key is required'));
        }

        const agent = req.headers['user-agent'];
        const agentInfo = parseUserAgent(agent);
        const isMobile = /mobile/i.test(agent);
        const isTablet = /tablet/i.test(agent);

        const linkData = await Link.findOne({ key });
        if (!linkData) {
            return res.status(404).json(new ApiError(404, 'page not found'));
        }
        linkData.clicks++;
        await Stats.findOneAndUpdate(
            { key },
            {
                $push: {
                    stats: [
                        {
                            os: agentInfo.os.name,
                            browser: agentInfo.browser.name,
                            device: isMobile
                                ? 'mobile'
                                : isTablet
                                ? 'tablet'
                                : 'desktop',
                        },
                    ],
                    geo: [
                        {
                            country: country || 'unknown',
                            city: city || 'unknown',
                            flag: flag || 'unknown',
                        },
                    ],
                },
            }
        );
        await linkData.save();
        res.redirect(linkData.originUrl);
    } catch (error) {
        return res
            .status(500)
            .json(new ApiError(500, 'error while redirecting', error));
    }
};

const shortLink = async (req, res) => {
    const { _id } = req.user;
    const { originUrl } = req.body;
    let { key } = req.body;

    if (!originUrl) {
        return res.status(400).json(new ApiError(400, 'url is required'));
    }
    try {
        const user = await User.findById(_id);
        const metaData = await getmetaData(originUrl);
        if (!key) {
            key = await getKey();
        } else {
            const existKey = await Link.findOne({ key: key });
            if (existKey) {
                throw new ApiError(400, 'key already exist');
            }
        }
        const shortenLink = await Link.create({
            key: key,
            originUrl: originUrl,
            user: user._id,
            title: metaData?.title,
            description: metaData?.description,
            image: metaData?.image,
            icon: metaData?.icon,
        });

        const data = await Link.findById(shortenLink._id);
        await Stats.create({ key: data.key, linkId: data._id });

        res.status(200).json(new ApiResponce(200, 'link created', data, true));
    } catch (error) {
        return res
            .status(500)
            .json(
                new ApiError(
                    500,
                    error.message || 'error while shorting link',
                    error
                )
            );
    }
};

const getAllLinks = asyncHandler(async (req, res) => {
    try {
        const { _id } = req.user;
        if (!_id) {
            throw new ApiError(401, 'unauthorized', null, false);
        }
        const links = await Link.find({ user: _id });
        if (!links) {
            throw new ApiError(404, 'links not found');
        }
        res.status(200).json(
            new ApiResponce(200, 'links', { links: links }, true)
        );
    } catch (error) {
        throw new ApiError(500, 'error while getting links', error);
    }
});

const getStats = asyncHandler(async (req, res) => {
    try {
        const { _id } = req.user;
        const { key } = req.params;

        if (!key) {
            throw new ApiError(400, 'key is required');
        }

        const stats = await Link.aggregate([
            {
                $match: {
                    key: key,
                    user: _id,
                },
            },
            {
                $lookup: {
                    from: 'stats',
                    localField: '_id',
                    foreignField: 'linkId',
                    as: 'stats',
                },
            },
            {
                $addFields: {
                    stats: {
                        $arrayElemAt: ['$stats', 0],
                    },
                },
            },
            {
                $project: {
                    key: 1,
                    originUrl: 1,
                    title: 1,
                    description: 1,
                    image: 1,
                    icon: 1,
                    clicks: 1,
                    stats: 1,
                },
            },
        ]);
        if (!stats) {
            throw new ApiError(404, 'stats not found');
        }
        res.status(200).json(new ApiResponce(200, 'success', { stats }, true));
    } catch (error) {
        throw new ApiError(500, 'error while getting stats', error);
    }
});

const deleteLink = asyncHandler(async (req, res) => {
    const user = req;
    if (!user) {
        throw new ApiError(401, 'unauthorized', null, false);
    }
    const { _id } = req.params;
    if (!_id) {
        throw new ApiError(400, 'id is required');
    }

    try {
        const link = await Link.findByIdAndDelete(_id);
        if (!link) {
            throw new ApiError(404, 'link not found');
        }
        await Stats.findOneAndDelete({ linkId: link._id });
        return res.status(200).json(new ApiResponce(200, 'link deleted'));
    } catch (error) {
        throw new ApiError(500, 'error while deleting link', error);
    }
});

export { shortLink, redirect, getAllLinks, getStats, deleteLink };

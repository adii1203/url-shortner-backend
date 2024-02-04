import mongoose, { Schema } from 'mongoose';

const StatsSchema = new Schema({
    linkId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Link',
    },
    key: {
        type: String,
        required: true,
    },
    stats: [
        {
            os: {
                type: String,
                required: true,
            },
            browser: {
                type: String,
                required: true,
            },
            device: {
                type: String,
                required: true,
            },
            date: {
                type: Date,
                default: Date.now,
            },
        },
    ],
    geo: [
        {
            country: {
                type: String,
                required: true,
            },
            city: {
                type: String,
                required: true,
            },
            flag: {
                type: String,
                required: true,
            },
        },
    ],
});

const Stats = mongoose.model('Stats', StatsSchema);
export default Stats;

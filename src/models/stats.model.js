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
    os: {
        type: Array,
    },
    browser: {
        type: Array,
    },
    country: {
        type: Array,
    },
    device: {
        type: Array,
    },
    city: {
        type: Array,
    },
});

const Stats = mongoose.model('Stats', StatsSchema);
export default Stats;

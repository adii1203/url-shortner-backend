import getMetaData from 'metadata-scraper';

export const getmetaData = async (urlString) => {
    try {
        const metaData = await getMetaData(urlString);
        return metaData;
    } catch (error) {
        console.log(error);
    }
};

// This script can be used as trailerFetchScript in the config file
// It will fetch trailers for the movies currently playing in theaters from TMDB
// Make sure to run `npm install axios ytdl-core` before running this script

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const ytdl = require('ytdl-core');

const TRAILERS_FOLDER = __dirname + '/trailers';
const TRAILER_LIMIT = 5; // Number of trailers to fetch
const LANGUAGE = 'en-US'; // Language to use for TMDB (https://developer.themoviedb.org/docs/languages)

// Ensure the trailers folder exists
if (!fs.existsSync(TRAILERS_FOLDER)) {
    fs.mkdirSync(TRAILERS_FOLDER);
}

const TMDB_API_KEY = 'e9ddd52cad67682dc3e4f742612326b7';
const fetchNowPlayingMovies = async () => {
    const url = `https://api.themoviedb.org/3/movie/now_playing?api_key=${TMDB_API_KEY}&language=${LANGUAGE}&page=1`;
    const response = await axios.get(url);
    return response.data.results.slice(0, TRAILER_LIMIT);
};

const fetchTrailerUrl = async (movieId) => {
    const url = `https://api.themoviedb.org/3/movie/${movieId}/videos?api_key=${TMDB_API_KEY}&language=${LANGUAGE}`;
    const response = await axios.get(url);
    const trailers = response.data.results.filter(video => video.type === 'Trailer' && video.site === 'YouTube');
    if (trailers.length > 0) {
        return `https://www.youtube.com/watch?v=${trailers[0].key}`;
    }
    return null;
};

const downloadTrailer = async (url, filepath) => {
    const stream = ytdl(url, { filter: 'audioandvideo', quality: 'highestvideo'});
    return new Promise((resolve, reject) => {
        stream.pipe(fs.createWriteStream(filepath))
            .on('finish', resolve)
            .on('error', reject);
    });
};

const manageTrailersFolder = async (currentTrailerFiles) => {
    const files = fs.readdirSync(TRAILERS_FOLDER);
    files.forEach(file => {
        if (!currentTrailerFiles.includes(file)) {
            fs.unlinkSync(path.join(TRAILERS_FOLDER, file));
        }
    });
};

const main = async () => {
    try {
        const nowPlayingMovies = await fetchNowPlayingMovies();
        const currentTrailerFiles = [];

        for (const movie of nowPlayingMovies) {
            const trailerUrl = await fetchTrailerUrl(movie.id);
            if (trailerUrl) {
                const trailerFileName = `${movie.id}.mp4`;
                const trailerFilePath = path.join(TRAILERS_FOLDER, trailerFileName);
                currentTrailerFiles.push(trailerFileName);

                if (!fs.existsSync(trailerFilePath)) {
                    console.log(`Downloading trailer for ${movie.title}...`);
                    await downloadTrailer(trailerUrl, trailerFilePath);
                    console.log(`Downloaded trailer for ${movie.title}`);
                } else {
                    console.log(`Trailer for ${movie.title} already exists.`);
                }
            } else {
                console.log(`No trailer found for ${movie.title}`);
            }
        }

        // Clean up old trailers
        await manageTrailersFolder(currentTrailerFiles);

    } catch (error) {
        console.error('Error occurred:', error);
    }
};

// Run the script
main();
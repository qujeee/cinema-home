# Cinema Home Example

This folder contains example data for Cinema Home. Create a folder and copy all contents from the example folder. Start the Cinema Home app and visit http://host-ip, go to settings and set the path to your Cinema Home folder.

## Configuration

Configure the `config.yml` file with your Jellyfin domain and API key. You can find the `config.yml` file in the root directory of Cinema Home.

### Adding the main and break image

The `config.yml` requires a main and break image, these need to be placed in the folder images.

## Creating a Sequence

To create a sequence in Cinema Home, you need to include intros, outros, a movie block, and additional commercial and trailer blocks. (See the example config.yml)

### Adding Intros and Outros

To add intros and outros to your sequence, place the corresponding video files in the `videos` folder.

## Fetching trailers

You can optionally define a fetchTrailerScript in `config.yml`. Cinema Home will run the exported main function from this script.
Export the function main like this:

```
module.exports = {
    main
};
```

The script needs to be placed in the same folder as the `config.yml`.
For the tmdb_fetch_trailers.js script to work you will maybe need to run `npm install axios ytdl-core` when using this script

## Starting Cinema Home

To start Cinema Home, run the Cinema Home program. Once it's running, you can access it on your phone by navigating to `http://host-ip`. From there, you can start a movie and control breaks.

Enjoy your movie experience with Cinema Home!

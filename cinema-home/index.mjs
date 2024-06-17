import { app, BrowserWindow, ipcMain, powerSaveBlocker  } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import axios from 'axios';
import loudness from 'loudness';
import yaml from 'js-yaml';
import fs from 'fs';
import schedule from 'node-schedule';

const __filename = fileURLToPath(import.meta.url);

const __dirname = path.dirname(__filename);



import Store from 'electron-store';

const store = new Store();
const dir = store.get('dir') ?? '';

let mainWindow;

var jellyfinDomain;
var jellyfinAPIKey;


function createWindow() {
    mainWindow = new BrowserWindow({
        fullscreen: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: true,
            contextIsolation: false
        }
    });
    mainWindow.webContents.on('dom-ready', (event)=> {
        let css = '* { cursor: none !important; }';
        mainWindow.webContents.insertCSS(css);
        mainWindow.webContents.send('dir', dir);
    });
    ipcMain.on('open-devtools', (event) => {
        mainWindow.webContents.openDevTools();
      });
      mainWindow.webContents.openDevTools();
    mainWindow.loadFile('index.html');
}

app.whenReady().then(() => {
    
    try {
        const doc = yaml.load(fs.readFileSync(dir + '/config.yml', 'utf8'));
        jellyfinDomain = doc.jellyfinDomain;
        jellyfinAPIKey = doc.jellyfinAPIKey;
        var trailerFetchScript = doc.trailerFetchScript
        if (trailerFetchScript && fs.existsSync(dir + '/' + trailerFetchScript)) {
            import(dir + '/' + trailerFetchScript).then((module) => {
                module.main();
                schedule.scheduleJob('0 0 * * *', function() {
                    module.main();
                });
            });
        }
    } catch (error) {
        console.error('Error reading config.yml:', error);
    }
    
    
    
    const server = express();
    server.use(express.json(), express.static(__dirname + '/web-ui'));

    server.post('/dir', (req, res) => {
        const newDir = req.body.dir;
        store.set('dir', newDir);
        res.sendStatus(200);
        app.relaunch()
        app.exit()
    });

    server.get('/search', async (req, res) => {
        const query = req.query.query;
        try {
            const response = await axios.get(`${jellyfinDomain}/Items`, {
                params: {
                    api_key: jellyfinAPIKey,
                    searchTerm: query,
                    IncludeItemTypes: 'Movie',
                    Recursive: true,
                    Limit: 5
                }
            });
            const movies = response.data.Items;
            res.json(movies);
        } catch (error) {
            console.error('Error fetching data from Jellyfin:', error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    });

    server.get('/subtitles', async (req, res) => {
        const itemID = req.query.itemID;
        try {
            const subtitles = await getSubtitles(itemID);
            res.json(subtitles);
        } catch (error) {
            console.error('Error fetching subtitles:', error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    });

    server.post('/start', async (req, res) => {
        try {
            const movieID = req.body.movieID;
            const subtitleIndex = req.body.subtitleIndex;
            mainWindow.webContents.send('start-movie', await getStreamObject(movieID, subtitleIndex));
            res.sendStatus(200);
        } catch (error) {
            console.error(error);
            res.sendStatus(500);
        }
    });

    server.get('/status', async (req, res) => {
        var err = '';
        var volume = 0;
        var autoBreak = true;
        try {
            volume = await loudness.getVolume();
        } catch (error) {
            err = error;
            console.error(error);
        }
        try {
            autoBreak = yaml.load(fs.readFileSync(dir + '/config.yml', 'utf8')).autoBreak;
        } catch (error) {
            err = error;
            console.error('Error reading config.yml:', error);
        }
        res.json({ volume, autoBreak, dir, err});
    });

    server.post('/volume', async (req, res) => {
        try {
            const volume = parseInt(req.body.volume);
            if (isNaN(volume) || volume < 0 || volume > 100) {
                return res.status(400).send('Volume must be a number between 0 and 100');
            }
    
            await loudness.setVolume(volume);
            res.sendStatus(200);
        } catch (error) {
            console.error(error);
            res.sendStatus(500);
        }
    });

    


    server.post('/break', async (req, res) => {
        try {
            mainWindow.webContents.send('toggle-break');
            res.sendStatus(200);
        } catch (error) {
            console.error(error);
            res.sendStatus(500);
        }
    });

    server.post('/rewind-15', async (req, res) => {
        try {
            mainWindow.webContents.send('rewind-15');
            res.sendStatus(200);
        } catch (error) {
            console.error(error);
            res.sendStatus(500);
        }
    });

    server.post('/forward-15', async (req, res) => {
        try {
            mainWindow.webContents.send('forward-15');
            res.sendStatus(200);
        } catch (error) {
            console.error(error);
            res.sendStatus(500);
        }
    });

    server.post('/time', async (req, res) => {
        try {
            const change = parseInt(req.body.change);
            mainWindow.webContents.send('timeChange', change);
            res.sendStatus(200);
        } catch (error) {
            console.error(error);
            res.sendStatus(500);
        }
    });

    server.post('/skip', async (req, res) => {
        try {
            mainWindow.webContents.send('skip');
            res.sendStatus(200);
        } catch (error) {
            console.error(error);
            res.sendStatus(500);
        }
    });

    server.post('/auto-break', async (req, res) => {
        try {
            const { enabled } = req.body;
            let doc = yaml.load(fs.readFileSync(dir + '/config.yml', 'utf8'));
            doc.autoBreak =  enabled;
            fs.writeFile(dir + '/config.yml', yaml.dump(doc), (err) => {
                if (err) {
                    res.sendStatus(500);
                    return console.error(err);
                }
            });;
            res.sendStatus(200);
        } catch (error) {
            console.error(error);
            res.sendStatus(500);
        }
    });
    
    try {
        server.listen(1888, () => {
            console.log('Server running on port 1888');
        }).on('error', function(err) { console.log(err)});;
    } catch (error) {
        console.error(error);
    }
    createWindow();
    powerSaveBlocker.start('prevent-display-sleep');
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    });
});
  

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});


ipcMain.on('quit-app', () => {
    app.quit();
});



const getAdministratorUserId = async () => {
    try {
      const response = await fetch(`${jellyfinDomain}/users?api_key=${jellyfinAPIKey}`);
      const users = await response.json();
  
      const adminUser = users.find(user => user.Policy.IsAdministrator);
      if (adminUser) {
        return adminUser.Id;
      } else {
        throw new Error('No administrator user found');
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      throw error;
    }
};
  
const getStreamObject = async (itemID, subtitleIndex) => {
    try {
      const response = await fetch(`${jellyfinDomain}/Items/${itemID}/PlaybackInfo?api_key=${jellyfinAPIKey}&UserId=${await getAdministratorUserId()}&AutoOpenLiveStream=true`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: '{"DeviceProfile":{"MaxStreamingBitrate":120000000,"MaxStaticBitrate":100000000,"MusicStreamingTranscodingBitrate":384000,"DirectPlayProfiles":[{"Container":"webm","Type":"Video","VideoCodec":"vp8,vp9,av1","AudioCodec":"vorbis,opus"},{"Container":"mp4,m4v","Type":"Video","VideoCodec":"h264,hevc,vp9,av1","AudioCodec":"aac,mp3,mp2,opus,flac,vorbis"},{"Container":"mov","Type":"Video","VideoCodec":"h264","AudioCodec":"aac,mp3,mp2,opus,flac,vorbis"},{"Container":"opus","Type":"Audio"},{"Container":"webm","AudioCodec":"opus","Type":"Audio"},{"Container":"mp3","Type":"Audio"},{"Container":"aac","Type":"Audio"},{"Container":"m4a","AudioCodec":"aac","Type":"Audio"},{"Container":"m4b","AudioCodec":"aac","Type":"Audio"},{"Container":"flac","Type":"Audio"},{"Container":"webma","Type":"Audio"},{"Container":"webm","AudioCodec":"webma","Type":"Audio"},{"Container":"wav","Type":"Audio"},{"Container":"ogg","Type":"Audio"},{"Container":"hls","Type":"Video","VideoCodec":"av1,hevc,h264","AudioCodec":"aac,mp2,opus,flac"},{"Container":"hls","Type":"Video","VideoCodec":"h264","AudioCodec":"aac,mp3,mp2"}],"TranscodingProfiles":[{"Container":"mp4","Type":"Audio","AudioCodec":"aac","Context":"Streaming","Protocol":"hls","MaxAudioChannels":"2","MinSegments":"2","BreakOnNonKeyFrames":true},{"Container":"aac","Type":"Audio","AudioCodec":"aac","Context":"Streaming","Protocol":"http","MaxAudioChannels":"2"},{"Container":"mp3","Type":"Audio","AudioCodec":"mp3","Context":"Streaming","Protocol":"http","MaxAudioChannels":"2"},{"Container":"opus","Type":"Audio","AudioCodec":"opus","Context":"Streaming","Protocol":"http","MaxAudioChannels":"2"},{"Container":"wav","Type":"Audio","AudioCodec":"wav","Context":"Streaming","Protocol":"http","MaxAudioChannels":"2"},{"Container":"opus","Type":"Audio","AudioCodec":"opus","Context":"Static","Protocol":"http","MaxAudioChannels":"2"},{"Container":"mp3","Type":"Audio","AudioCodec":"mp3","Context":"Static","Protocol":"http","MaxAudioChannels":"2"},{"Container":"aac","Type":"Audio","AudioCodec":"aac","Context":"Static","Protocol":"http","MaxAudioChannels":"2"},{"Container":"wav","Type":"Audio","AudioCodec":"wav","Context":"Static","Protocol":"http","MaxAudioChannels":"2"},{"Container":"mp4","Type":"Video","AudioCodec":"aac,mp2,opus,flac","VideoCodec":"av1,hevc,h264","Context":"Streaming","Protocol":"hls","MaxAudioChannels":"2","MinSegments":"2","BreakOnNonKeyFrames":true},{"Container":"ts","Type":"Video","AudioCodec":"aac,mp3,mp2","VideoCodec":"h264","Context":"Streaming","Protocol":"hls","MaxAudioChannels":"2","MinSegments":"2","BreakOnNonKeyFrames":true}],"ContainerProfiles":[],"CodecProfiles":[{"Type":"VideoAudio","Codec":"aac","Conditions":[{"Condition":"Equals","Property":"IsSecondaryAudio","Value":"false","IsRequired":false}]},{"Type":"VideoAudio","Conditions":[{"Condition":"Equals","Property":"IsSecondaryAudio","Value":"false","IsRequired":false}]},{"Type":"Video","Codec":"h264","Conditions":[{"Condition":"NotEquals","Property":"IsAnamorphic","Value":"true","IsRequired":false},{"Condition":"EqualsAny","Property":"VideoProfile","Value":"high|main|baseline|constrained baseline|high 10","IsRequired":false},{"Condition":"EqualsAny","Property":"VideoRangeType","Value":"SDR","IsRequired":false},{"Condition":"LessThanEqual","Property":"VideoLevel","Value":"52","IsRequired":false},{"Condition":"NotEquals","Property":"IsInterlaced","Value":"true","IsRequired":false}]},{"Type":"Video","Codec":"hevc","Conditions":[{"Condition":"NotEquals","Property":"IsAnamorphic","Value":"true","IsRequired":false},{"Condition":"EqualsAny","Property":"VideoProfile","Value":"main|main 10","IsRequired":false},{"Condition":"EqualsAny","Property":"VideoRangeType","Value":"SDR|HDR10|HLG","IsRequired":false},{"Condition":"LessThanEqual","Property":"VideoLevel","Value":"183","IsRequired":false},{"Condition":"NotEquals","Property":"IsInterlaced","Value":"true","IsRequired":false}]},{"Type":"Video","Codec":"vp9","Conditions":[{"Condition":"EqualsAny","Property":"VideoRangeType","Value":"SDR|HDR10|HLG","IsRequired":false}]},{"Type":"Video","Codec":"av1","Conditions":[{"Condition":"NotEquals","Property":"IsAnamorphic","Value":"true","IsRequired":false},{"Condition":"EqualsAny","Property":"VideoProfile","Value":"main","IsRequired":false},{"Condition":"EqualsAny","Property":"VideoRangeType","Value":"SDR|HDR10|HLG","IsRequired":false},{"Condition":"LessThanEqual","Property":"VideoLevel","Value":"19","IsRequired":false}]}],"SubtitleProfiles":[{"Format":"vtt","Method":"External"},{"Format":"ass","Method":"External"},{"Format":"ssa","Method":"External"}],"ResponseProfiles":[{"Type":"Video","Container":"m4v","MimeType":"video/mp4"}]}}'
      });
  
      const playbackInfo = await response.json();
  
      if (playbackInfo && playbackInfo.MediaSources && playbackInfo.MediaSources.length > 0) {
        const mediaSource = playbackInfo.MediaSources[0];
        const subtitleUrl = (subtitleIndex != "") ? jellyfinDomain + mediaSource.MediaStreams[subtitleIndex].DeliveryUrl : "";
        if (mediaSource.TranscodingUrl) {
            return {src: { src: jellyfinDomain + mediaSource.TranscodingUrl, type: 'application/x-mpegURL' }, subUrl: subtitleUrl };
        }
        return {src: { src: jellyfinDomain + '/Items/' + itemID + '/Download?api_key=' + jellyfinAPIKey, type: 'video/mp4' }, subUrl: subtitleUrl };
      } else {
        throw new Error('Playback information not available or no media sources found');
      }
    } catch (error) {
      console.error('Error fetching playback info:', error);
      throw error;
    }
};

const getSubtitles = async (itemID) => {
    try {
        const response = await fetch(`${jellyfinDomain}/Items/${itemID}?api_key=${jellyfinAPIKey}&UserId=${await getAdministratorUserId()}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          } });
    
        const itemInfo = await response.json();
        if (itemInfo && itemInfo.MediaSources && itemInfo.MediaSources.length > 0 && itemInfo.MediaSources[0].MediaStreams && itemInfo.MediaSources[0].MediaStreams.length > 0) {
          const mediaStreams = itemInfo.MediaSources[0].MediaStreams;
            const subtitles = mediaStreams
            .filter(stream => stream.Type === 'Subtitle')
            .map(subtitle => ({
                index: subtitle.Index,
                displayTitle: subtitle.DisplayTitle
            }));
        return subtitles;
        } else {
          throw new Error('Playback information not available or no media sources found');
        }
      } catch (error) {
        console.error('Error fetching playback info:', error);
        throw error;
      }
}
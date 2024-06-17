

const videojs = require('video.js');
const video = videojs('video', {
    controlBar: false,
    loadingSpinner: false,
    bigPlayButton: false,
    controls: false,
    textTrackSettings: false,
    fill: true,
    html5: {nativeTextTracks: true}
  });
const videoDOM = document.getElementById('video');
const mainImage = document.getElementById('main-image');
const breakImage = document.getElementById('break-image');
const welcomeImage = document.getElementById('welcome-image');

const yaml = require('js-yaml');
const fs   = require('fs');
const axios = require('axios');
const { ipcRenderer } = require('electron');



let doc;

function waitForDir() {
    return new Promise((resolve) => {
        ipcRenderer.on('dir', (_event, arg) => {
            resolve(arg);
        });
    });
}

var dir = '';




waitForDir().then((newDir) => {
    try {
        dir = newDir
        doc = yaml.load(fs.readFileSync(dir + '/config.yml', 'utf8'));
        document.getElementById("main-image").src = dir + '/images/' + doc.mainImage;
        document.getElementById("break-image").src = dir + '/images/' + doc.breakImage;
    } catch (error) {
        console.log(error);
        document.getElementById("main-image").style.visibility  = 'hidden';
        document.getElementById("break-image").style.visibility = 'hidden';
        require('dns').lookup(require('os').hostname(), { family: 4 }, function (err, add, fam) {
            if (err) {
                console.error(err);
                return;
            }
            document.getElementById("ip").innerText = 'Visit http://' + add.toString() + ':1888';
        })
       
        welcomeImage.style.visibility = 'visible';
        welcomeImage.style.opacity = 1;
    }
});
    



var playlist = [
];

let currentVideoIndex = 0;
let movieIndex = 0;
let isPlaying = false;
var middleDetected = false;
var subtitleUrl = '';

function loadVideo(index) {
    document.getElementsByName("video").innerHTML = '';
    video.src(playlist[index].c);
    
    if (index === movieIndex && subtitleUrl !== "") {
        video.addRemoteTextTrack({
            kind: 'captions',
            label: 'Captions',
            src: subtitleUrl,
            srclang: 'en',
            default: true
        });
    }
    
    video.load();
}

function hideVideo(hide) {
    if (hide) {
        videoDOM.style.visibility = 'hidden';
    } else {
        videoDOM.style.visibility = 'visible';
    }
}

function hideBreakImage(hide) {
    if (hide) {
        breakImage.style.opacity = 0;
        setTimeout(() => {
            breakImage.style.visibility = 'hidden';
        }, 4000);
    } else {
        breakImage.style.visibility = 'visible';
        breakImage.style.opacity = 1;
    }
}


async function playPlaylist(movieUrl) {
        try {
            playlist = [];
            const newPlaylist = doc.sequence.map(obj => ({...obj}));
            for (let i = 0; i < newPlaylist.length; i++) {
                if (newPlaylist[i].c === "commercials") {
                    const commercialHA = newPlaylist[i].HA  ?? "";
                    const files = await loadRandomFiles(dir + '/commercials', doc.commercialAmount);
                    files.forEach((file, index) => {
                        playlist.push((index === 0 && commercialHA != "") ? {c: dir + '/commercials/' + file, HA: commercialHA} : {c: dir + '/commercials/' + file});
                    });
                } else if (newPlaylist[i].c === "trailers") {
                    const trailerHA = newPlaylist[i].HA ?? "";
                    const files = await loadRandomFiles(dir + '/trailers', doc.trailerAmount);
                    files.forEach((file, index) => {
                        playlist.push((index === 0 && trailerHA != "") ? {c: dir + '/trailers/' + file, HA: trailerHA} : {c: dir + '/trailers/' + file});
                    });
                } else if (newPlaylist[i].c === "movie") {
                    const movieHA = newPlaylist[i].HA ?? "";
                    subtitleUrl = movieUrl.subUrl;
                    playlist.push((movieHA != "") ? {c: movieUrl.src, HA: movieHA} : {c: movieUrl.src});
                } else {
                    playlist.push({c: dir + `/videos/${newPlaylist[i].c}`, HA: newPlaylist[i].HA});
                }
                
            }
            movieIndex = playlist.findIndex(item => item.c === movieUrl.src);
            isPlaying = true;
            middleDetected = false;
            hideVideo(false)
            mainImage.style.visibility = 'hidden';
            hideBreakImage(true);
            currentVideoIndex = 0;
            loadVideo(currentVideoIndex);
            video.play();
          } catch (e) {
            console.log(e);
          }
          
        
}

function detectMiddle() {
    const currentTime = video.currentTime();
    const duration = video.duration();

    // Check if the video has a valid duration
    if (duration > 0) {
        const middleTime = duration / 2;

        // Allow some tolerance around the exact middle
        const tolerance = 2;
        if (!middleDetected && currentTime >= (middleTime - tolerance) && currentTime <= (middleTime + tolerance)) {
            try {
                if (yaml.load(fs.readFileSync(dir + '/config.yml', 'utf8')).autoBreak) {
                    middleDetected = true;
                    video.pause();
                    hideVideo(true);
                    hideBreakImage(false);
                    video.currentTime(currentTime  - 30);
                }
            } catch (error) {
                console.log(error);
            }
        }
    }
    
}

async function callHAScript(script)  {
    const response = await axios.post(`${doc.homeAssistantDomain}/api/services/script/${script}`, {}, {
        headers: {
            'Authorization': `Bearer ${doc.homeAssistantAPIKey}`,
            'Content-Type': 'application/json'
        },
        
    });
}

video.on('play', async () => {
    const script = playlist[currentVideoIndex].HA;
    if (script && script !== "") {
        callHAScript(script);
    }
} );


video.on('ended', () => {
    video.off('timeupdate', detectMiddle);
    currentVideoIndex++;
    if (currentVideoIndex < playlist.length) {
        loadVideo(currentVideoIndex);
        video.play();
        if (currentVideoIndex === movieIndex) {
            video.on('timeupdate', detectMiddle );
            
        }
        
    } else {
        isPlaying = false;
        hideVideo(true)
        mainImage.style.visibility = 'visible';
        const endHAScript = doc.endHAScript ?? "";
        if (endHAScript != "") {
            callHAScript(endHAScript);
        }
    }
});

function toggleBreak() {
    if (breakImage.style.visibility === 'hidden') {
        video.pause();
        hideVideo(true);
        hideBreakImage(false);
        video.currentTime(video.currentTime() - 30);
        const script = doc.breakHAScript;
        if (script && script !== "") {
            callHAScript(script);
        }
        
    } else {
        
            hideBreakImage(true);
            setTimeout(() => {
                if (isPlaying) {

                video.play();
                }
                hideVideo(false);
            }, 4000);
        
    }
}


ipcRenderer.on('start-movie', (_event, arg) => {
    playPlaylist(arg);
 });

ipcRenderer.on('toggle-break', (_event, arg) => {
    toggleBreak();
});

ipcRenderer.on('rewind-15', (_event, arg) => {
    video.currentTime(video.currentTime() - 15);
});

ipcRenderer.on('forward-15', (_event, arg) => {
    video.currentTime(video.currentTime() + 15);
 });

ipcRenderer.on('timeChange', (_event, arg) => {
    video.currentTime(video.currentTime() + arg);
});

ipcRenderer.on('skip', (_event, arg) => {
    video.off('timeupdate', detectMiddle);
    if (isPlaying) {
        currentVideoIndex++;
        if (currentVideoIndex < playlist.length) {
            loadVideo(currentVideoIndex);
            video.play();
            if (currentVideoIndex === movieIndex) {
                video.on('timeupdate', detectMiddle );
            }
        } else {
            isPlaying = false;
            video.pause();
            hideVideo(true)
            mainImage.style.visibility = 'visible';
            const endHAScript = doc.endHAScript ?? "";
            if (endHAScript != "") {
                callHAScript(doc.endHAScript);
            }
        }
    }
    
});

function getFilesFromDirectory(directoryPath) {
    return new Promise((resolve, reject) => {
        fs.readdir(directoryPath, (err, files) => {
            if (err) {
                return reject(err);
            }
            // Filter the files to only include video files
            const videoFiles = files.filter(file => {
                const extension = file.split('.').pop();
                return ['mp4', 'avi', 'mkv', 'mov', 'webm'].includes(extension);
            });
            resolve(videoFiles);
        });
    });
}
  
  // Function to shuffle an array
  function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

// Quit on ESC key for 5 seconds
let escKeyHeld = false;
let escKeyTimer;

document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !escKeyHeld) {
      escKeyHeld = true;
      escKeyTimer = setTimeout(() => {
        ipcRenderer.send('quit-app');
      }, 5000);
    }
    if (event.key == 'i') {
        ipcRenderer.send('open-devtools')
    }
  });
  
  document.addEventListener('keyup', (event) => {
    if (event.key === 'Escape') {
      clearTimeout(escKeyTimer);
      escKeyHeld = false;
    }
  });

  async function loadRandomFiles(directoryPath, amount) {
    try {
      // Get the list of files
      const files = await getFilesFromDirectory(directoryPath);
      
      // Shuffle the list of files
      const shuffledFiles = shuffleArray(files);
      
      // Select the first 3 files
      const randomFiles = shuffledFiles.slice(0, amount);
  
      // Read the contents of the selected files

  
  
      // Return the file names and their contents
      return randomFiles.map((file, index) => (file));
    } catch (error) {
      console.error('Error loading random files:', error);
    }
  };
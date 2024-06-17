fetch('/status', {
    method: 'GET'
})
    .then(response => response.json())
    .then(data => {
        document.getElementById('volume').value = data.volume;
        document.getElementById('auto-break').checked = data.autoBreak;
        document.getElementById('dir').value = data.dir;
    });

document.getElementById('volume').addEventListener('change', function(event) {
    fetch('/volume', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            volume: event.target.value
        })
    });
});

document.getElementById('rewind-button').addEventListener('click', function() {
    fetch('/rewind-15', {
        method: 'POST'
    });
});

document.getElementById('forward-button').addEventListener('click', function() {
    fetch('/forward-15', {
        method: 'POST'
    });
});


document.getElementById('skip-button').addEventListener('click', function() {
    fetch('/skip', {
        method: 'POST'
    });
});


document.getElementById('break-button').addEventListener('click', function() {
    fetch('/break', {
        method: 'POST'
    });
});


document.getElementById('searchInput').addEventListener('input', function() {
    const query = this.value;
    if (query.length > 2) {
        fetch(`/search?query=${encodeURIComponent(query)}`)
            .then(response => response.json())
            .then(data => {
                const resultsContainer = document.getElementById('results');
                resultsContainer.innerHTML = '';
                data.forEach(movie => {
                    const li = document.createElement('li');
                    li.classList.add('p-2', '[&:not(:last-child)]:border-b', 'border-gray-200', 'flex', 'justify-between', 'items-center');
                    li.innerHTML = `<span>${movie.Name}</span>
                                    <button class="start-button text-white bg-green-600 hover:bg-green-700 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-4 py-2 " data-id="${movie.Id}" onclick="stream_options_modal.showModal()">Start</button>`;
                    resultsContainer.appendChild(li);
                });

                document.querySelectorAll('.start-button').forEach(button => {
                    button.addEventListener('click', function() {
                        const movieId = this.getAttribute('data-id');
                        fetch(`/subtitles?itemID=${movieId}`, {
                            method: 'GET'
                        })
                            .then(response => response.json())
                            .then(data => {
                                const subtitlesSelect = document.getElementById('subtitles');
                                subtitlesSelect.innerHTML = '';
                                subtitlesHTML = '';
                                subtitlesHTML += `<option value="" selected>No subtitles</option>`;
                                data.forEach(subtitle => {
                                    subtitlesHTML += `<option value="${subtitle.index}">${subtitle.displayTitle}</option>`;
                                });
                                subtitlesSelect.innerHTML = subtitlesHTML;
                            });
                        
                        document.getElementById('play-button').setAttribute('data-id', movieId);
                    });
                });
            });
    } else {
        document.getElementById('results').innerHTML = '';
    }
});

document.getElementById('play-button').addEventListener('click', function() {
    const movieId = document.getElementById('play-button').getAttribute('data-id');
    const subtitleIndex = document.getElementById('subtitles').value;
    startMovie(movieId, subtitleIndex);
});

function startMovie(movieId, subtitleIndex) {
    fetch('/start', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            movieID: movieId,
            subtitleIndex: subtitleIndex
        })
    }).then((res) => { 
        if (res.status === 200) {
            document.getElementById('searchInput').value = '';
            document.getElementById('results').innerHTML = '';
        }
      });
}

document.getElementById('auto-break').addEventListener('change', function(event) {
    console.log(event.target.checked);
    fetch('/auto-break', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            enabled: event.target.checked
        })
    });
});


document.getElementById('send-dir').addEventListener('click', function() {
    fetch('/dir', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            dir: document.getElementById('dir').value
        })
    });
});

document.getElementById('rewind-slider').addEventListener('change', function(event) {
    let value;
    switch (event.target.value) {
        case '25':
            value = 60;
            break;
        case '50':
            value = 60 * 5;
            break;
        case '75':
            value = 60 * 15;
            break;
        case '100':
            value = 60 * 30;
            break;
        case '125':
            value = 60 * 60;
            break;
    }
    fetch('/time', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            change: -1 * value
        })
    }).then((res) => {
        if (res.status === 200) {
            document.getElementById('rewind-slider').value = '0';
        }
    });;
});

document.getElementById('forward-slider').addEventListener('change', function(event) {
    let value;
    switch (event.target.value) {
        case '25':
            value = 60;
            break;
        case '50':
            value = 60 * 5;
            break;
        case '75':
            value = 60 * 15;
            break;
        case '100':
            value = 60 * 30;
            break;
        case '125':
            value = 60 * 60;
            break;
    }
    fetch('/time', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            change: value
        })
    }).then((res) => {
        if (res.status === 200) {
            document.getElementById('forward-slider').value = '0';
        }
    });
});
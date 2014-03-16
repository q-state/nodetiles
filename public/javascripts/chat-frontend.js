$(function () {
    "use strict";

    // for better performance - to avoid searching in DOM
    var content = $('#content');
    var input = $('#input');
    var status = $('#status');

    // my color assigned by the server
    var myColor = false;
    // my name sent to the server
    var myName = false;

    // if user is running mozilla then use it's built-in WebSocket
    window.WebSocket = window.WebSocket || window.MozWebSocket;

    // if browser doesn't support WebSocket, just show some notification and exit
    if (!window.WebSocket) {
        content.html($('<p>', { text: 'Sorry, but your browser doesn\'t '
            + 'support WebSockets.'} ));
        input.hide();
        $('span').hide();
        return;
    }

    // open connection
    var connection = new WebSocket('ws://' + document.location.hostname);

    connection.onopen = function () {
        // first we want users to enter their names
        input.removeAttr('disabled');
        status.text('Choose name:');
        input.focus();

        // send keep-alive
        setInterval(function() {
            connection.send(JSON.stringify({ka:1}));
        }, 30000 );
    };

    connection.onerror = function (error) {
        content.html($('<p>', { text: 'Sorry, but there\'s some problem with your '
            + 'connection or the server is down.' } ));
    };

    // most important part - incoming messages
    connection.onmessage = function (message) {
        // try to parse JSON message. Because we know that the server always returns
        // JSON this should work without any problem but we should make sure that
        // the massage is not chunked or otherwise damaged.
        try {
            var json = JSON.parse(message.data);
        } catch (e) {
            console.log('This doesn\'t look like a valid JSON: ', message.data);
            return;
        }

        if (json.type === 'cds') {
            if(json.data.u != myName) {
                var boxData = json.data;
                $('#box' + boxData.id).offset({ top: boxData.y, left: boxData.x });
                var api = $('#box' + boxData.id).qtip('api');
                api.reposition(null, false);
            }
        }

        if (json.type === 'history') {
            // received the history (positions of boxes)
            initializeBoxes(json.data);
        }

        if (json.type === 'dstart') {
            if(json.data.u != myName) {
                var boxData = json.data;
                $('#box' + boxData.id).qtip({
                    content: boxData.u,
                    position: {
                        corner: {
                            target: 'topRight',
                            tooltip: 'bottomLeft'
                        }
                    }
                });

                var api = $('#box' + boxData.id).qtip('api');
                api.show();
            }
        }

        if (json.type === 'dstop') {
            if(json.data.u != myName) {
                var boxData = json.data;

                var api = $('#box' + boxData.id).qtip('api');
                api.destroy();
            }
        }

    };

    /**
     * Send message when user presses Enter key
     */
    input.keydown(function(e) {
        if (e.keyCode === 13) {
            var msg = $(this).val();
            if (!msg) {
                return;
            }
            // send the message as an ordinary text
            connection.send(JSON.stringify({ type: 'logon', name: msg}));
            $(this).val('');
            // disable the input field to make the user wait until server
            // sends back response
            input.attr('disabled', 'disabled');

            // we know that the first message sent from a user their name
            if (myName === false) {
                myName = msg;
                $('#instructions').hide();
            }
        }
    });

    /**
     * This method is optional. If the server wasn't able to respond to the
     * in 3 seconds then show some error message to notify the user that
     * something is wrong.
     */
    setInterval(function() {
        if (connection.readyState !== 1) {
            status.text('Error');
            input.attr('disabled', 'disabled').val('Unable to communicate '
                + 'with the WebSocket server.');
        }
    }, 3000);

    /**
     * Add message to the chat window
     */

    function makeBoxesDraggable() {
        $(".box").draggable({
            drag: function(ev) {
                var target = ev.target;
                var newCoords = { type: 'cds', a: myName, id: this.id.replace('box', ''), x: target.offsetLeft, y: target.offsetTop };
                connection.send(JSON.stringify(newCoords));
            },
            start: function(ev)
            {
                var payload = { type: 'dstart', a: myName, id: this.id.replace('box', '')  };
                connection.send(JSON.stringify(payload));
            },
            stop: function(ev)
            {
                var payload = { type: 'dstop', a: myName, id: this.id.replace('box', '')  };
                connection.send(JSON.stringify(payload));
            }
        });
    }

    function initializeBoxes(boxData) {
        // initialize boxes
        $.each(boxData, function(index, box) {
            var newBox = $("<div>").addClass("box").attr({ id: 'box' + box.id }).offset({ left: box.x, top: box.y }).html('<div class="letter">' + box.letter + '</div>');
            $('body').append(newBox);
        });

        makeBoxesDraggable();
    }
});
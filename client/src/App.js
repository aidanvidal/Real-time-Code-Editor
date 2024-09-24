import React, { useEffect, useState, useRef, useCallback } from 'react';
import axios from 'axios';
import debounce from 'lodash/debounce'; 
import './App.css';
import ReconnectingWebSocket from 'reconnecting-websocket';
import sharedb from 'sharedb/lib/client';
import AceEditor from 'react-ace';
import 'ace-builds/src-noconflict/mode-javascript';
import 'ace-builds/src-noconflict/theme-monokai';
import 'ace-builds/src-noconflict/ext-language_tools';
import ace from 'ace-builds/src-noconflict/ace';

function App() {
    const [isConnected, setIsConnected] = useState(false); // Connection to wss
    const [content, setContent] = useState('');
    const [output, setOutput] = useState('');
    const editorRef = useRef(null); // AceEditor ref
    const docRef = useRef(null); // ShareDB doc ref
    const localBufferRef = useRef('');
    const isRemoteChangeRef = useRef(false);
    const localPresenceRef = useRef(null);
    const cursorMarkersRef = useRef({}); // Container for remote cursor ref

    useEffect(() => {
        // Autocomplete
        ace.require("ace-builds/src-noconflict/ext-language_tools");

        const socket = new ReconnectingWebSocket('ws://localhost:3001', [], {
            maxEnqueuedMessages: 0
        });

        const connection = new sharedb.Connection(socket);
        const doc = connection.get('examples', 'textarea');
        // Presence used for cursor updates
        const presence = connection.getPresence('examples', 'textarea');
        const localPresence = presence.create();
        localPresenceRef.current = localPresence;

        docRef.current = doc;

        socket.addEventListener('open', () => {
            console.log('WebSocket connected');
            setIsConnected(true);
        });

        socket.addEventListener('close', () => {
            console.log('WebSocket disconnected');
            setIsConnected(false);
        });

        socket.addEventListener('error', () => {
            console.log('WebSocket error');
        });

        doc.subscribe((error) => {
            if (error) {
                console.error('Document subscription error:', error);
                return;
            }

            setContent(doc.data.content || '');
            localBufferRef.current = doc.data.content || '';

            doc.on('op', (op, source) => {
                if (source === true) return;
                isRemoteChangeRef.current = true;
                applyOpToAce(op);
                isRemoteChangeRef.current = false;
            });

            if (editorRef.current && editorRef.current.editor) {
                setupCursorTracking(editorRef.current.editor, localPresence, connection.id);
            }
        });

        // Handle All Cursor Updates
        presence.subscribe();
        presence.on('receive', (id, presenceData) => {
            if (id !== connection.id && presenceData && presenceData.cursor) {
            updateRemoteCursor(id, presenceData.cursor);
            }
            else{
                removeRemoteCursor(id);
            }
        });

        presence.on('leave', (id) => {
            removeRemoteCursor(id);
        });

        return () => {
            socket.close();
        };
    }, []);

    // Setup Cursor for tracking
    const setupCursorTracking = (editor, localPresence, connectionId) => {
        // Create sender listener
        const sendCursorPosition = () => {
            const cursor = editor.getSelectionRange();
            localPresence.submit({ clientId: connectionId, cursor: cursor });
        };

        // Create the listeners
        const debouncedSendCursorPosition = debounce(sendCursorPosition, 100);
        editor.selection.on('changeCursor', () => {
            debouncedSendCursorPosition();
        });
        editor.selection.on('changeSelection', () => {
            debouncedSendCursorPosition();
        });
    };

    // Handle updates when client recieves a new cursor update
    const updateRemoteCursor = (id, cursorPosition) => {
        const editor = editorRef.current.editor;
        if (!editor) return;
    
        removeRemoteCursor(id);
    
        let endColumn = cursorPosition.end.column;
        if (cursorPosition.start.column === cursorPosition.end.column && cursorPosition.start.row === cursorPosition.end.row) {
            endColumn += 1;
        }
    
        const range = new ace.Range(
            cursorPosition.start.row, cursorPosition.start.column,
            cursorPosition.end.row, endColumn
        );
        const color = getColorForId(id);
        const marker = editor.getSession().addMarker(range, `remote-cursor-${id}`, "text");
        cursorMarkersRef.current[id] = marker;
    
        // Dynamically create and inject the style rule for the specific cursor
        const styleElement = document.createElement('style');
        styleElement.innerHTML = `
            .ace_marker-layer .remote-cursor-${id} {
                position: absolute;
                z-index: 20;
                border-left: 2px solid ${color};
                background-color: ${color};
            }
        `;
        document.head.appendChild(styleElement);
    
        // Update the cursor element's custom property for color
        document.documentElement.style.setProperty(`--remote-cursor-color-${id}`, color);
    
        const cursorElement = document.querySelector(`.remote-cursor-${id}`);
        if (cursorElement) {
            cursorElement.style.setProperty('--remote-cursor-color', color);
        }
    };
    
    // Removes a disconnected client's cursor
    const removeRemoteCursor = (id) => {
        const editor = editorRef.current.editor;
        if (!editor) return;
    
        const markerId = cursorMarkersRef.current[id];
        if (markerId) {
            editor.getSession().removeMarker(markerId);
            delete cursorMarkersRef.current[id];
    
            // Remove the custom property when the cursor is removed
            document.documentElement.style.removeProperty(`--remote-cursor-color-${id}`);
            
            // Optionally remove the dynamically created style element if you want to clean up
            const styleElement = document.querySelector(`style.remote-cursor-${id}`);
            if (styleElement) styleElement.remove();
        }
    };

    // Helper function to get colors for cursors
    const getColorForId = (id) => {
        const colors = [
            'rgba(255, 65, 54, 0.5)',   // Red
            'rgba(255, 133, 27, 0.5)',  // Orange
            'rgba(255, 220, 0, 0.5)',   // Yellow
            'rgba(46, 204, 64, 0.5)',   // Green
            'rgba(0, 116, 217, 0.5)',   // Blue
            'rgba(177, 13, 201, 0.5)',  // Purple
            'rgba(255, 105, 180, 0.5)', // Pink
            'rgba(0, 191, 255, 0.5)',   // Deep Sky Blue
            'rgba(34, 139, 34, 0.5)',   // Forest Green
            'rgba(255, 69, 0, 0.5)'     // Orange Red
        ];
        return colors[id.hashCode() % colors.length];
    };

    // Hash function for string (for consistent color assignment)
    String.prototype.hashCode = function() {
        let hash = 0;
        for (let i = 0; i < this.length; i++) {
            const char = this.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash);
    };

    // Adds text to the editor on updates
    const applyOpToAce = (op) => {
        const editor = editorRef.current.editor;
        if (!editor) return;

        op.forEach(component => {
            if (component.si) {
                editor.session.insert(editor.session.doc.indexToPosition(component.p[1]), component.si);
            } else if (component.sd) {
                const from = editor.session.doc.indexToPosition(component.p[1]);
                const to = editor.session.doc.indexToPosition(component.p[1] + component.sd.length);
                editor.session.remove({ start: from, end: to });
            }
        });

        localBufferRef.current = editor.getValue();
        setContent(editor.getValue());
    };

    // Helper function to prevent a feedback loop
    const sendBufferedChanges = useCallback(debounce(() => {
        const currentContent = editorRef.current.editor.getValue();
        const op = getChangeOp(localBufferRef.current, currentContent);
        if (op) {
            docRef.current.submitOp(op, { source: true });
            localBufferRef.current = currentContent;
        }
    }, 50), []);

    // Send out changes made to the editor
    const handleChange = (newValue) => {
        if (isRemoteChangeRef.current) return;
        setContent(newValue);
        sendBufferedChanges();
    };

    // Helper function used to determin what updates were made to the editor
    const getChangeOp = (oldContent, newContent) => {
        let i = 0;
        while (i < oldContent.length && i < newContent.length && oldContent[i] === newContent[i]) i++;
        let j = 0;
        while (j < oldContent.length - i && j < newContent.length - i &&
               oldContent[oldContent.length - 1 - j] === newContent[newContent.length - 1 - j]) j++;

        const op = [];
        if (i + j !== oldContent.length) {
            op.push({ p: ['content', i], sd: oldContent.slice(i, oldContent.length - j) });
        }
        if (i + j !== newContent.length) {
            op.push({ p: ['content', i], si: newContent.slice(i, newContent.length - j) });
        }
        return op.length ? op : null;
    };

    // Function to run send code in the editor to be run on the server
    async function runCode() {
        // Send the code to the server to be executed
        try {
            const response = await axios.post('http://localhost:3001/execute', {
                code: content
            });
            setOutput(JSON.stringify(response.data.result, null, 2));
        } catch (error) {
            setOutput(`Error: ${error.response?.data?.error || error.message}`);
        }
    }

    return (
        <div className="App">
            <header className="App-header">
                <h1>Real-time Collaborative Editor</h1>
                <p>Connection status: {isConnected ? 'Connected' : 'Disconnected'}</p>
                <AceEditor
                    ref={editorRef}
                    mode="javascript"
                    theme="monokai"
                    value={content}
                    onChange={handleChange}
                    name="UNIQUE_ID_OF_DIV"
                    editorProps={{ $blockScrolling: true }}
                    setOptions={{
                        enableBasicAutocompletion: true,
                        enableLiveAutocompletion: true,
                        enableSnippets: false,
                        useWorker: false
                    }}
                    style={{ width: '100%', height: '400px' }}
                    onLoad={(editor) => {
                        if (localPresenceRef.current) {
                            setupCursorTracking(editor, localPresenceRef.current, docRef.current.connection.id);
                        }
                    }}
                />
                <button onClick={() => runCode(content)}>Run</button>
                <pre>{output}</pre>
            </header>
        </div>
    );
}

export default App;

'use client'

import React, { useEffect, useState } from 'react';
import { Grid, Stack, Box, TextField, Typography, LinearProgress, Button } from '@mui/material';
import { Mic, MicNone, Summarize, DeleteSweep, SyncAlt } from '@mui/icons-material';
import { translate, summarize, buildMessage, Status, getConfig } from '../utils';
import { Language, Name, Summarization, Chat } from './components';
import { startSttFromMic, stopSttFromMic } from '../stt';
import { registerSocket, sendMessage, syncMessages, clearMessages } from '../socket';

export default function App() {
    const [entries, setEntries] = useState([]);
    const [status, setStatus] = useState(Status.IDLE);
    const [summarization, setSummarization] = useState([]);
    const [recognizedText, setRecognizedText] = useState('');
    const [recognizingText, setRecognizingText] = useState('');
    const [language, setLanguage] = useState('he-IL');
    const [translateLanguage, setTranslateLanguage] = useState('en-US');
    const [name, setName] = useState('');
    const [config, setConfig] = useState(undefined);
    const [socketEntry, setSocketEntry] = useState(undefined);

    useEffect(() => {
        if (!socketEntry) return;
        if (!name) return;
        if (!entries) return;
        if (!setEntries) return;
        if (socketEntry.name === name) return;
        if (socketEntry.type !== 'message') return;
        if (entries.findIndex((entry) => entry.id === socketEntry.id) !== -1) return;
        const copy = [socketEntry, ...entries];
        copy.sort((a, b) => b.id.localeCompare(a.id));
        setEntries(copy);
    }, [socketEntry, name, entries, setEntries]);


    useEffect(() => {
        const fetchConfig = async () => {
            const conf = await getConfig();
            setConfig(conf);
        }

        fetchConfig();
    }, [setConfig]);

    useEffect(() => {
        if (!config) return;

        const onMessage = (entry) => {
            setSocketEntry(entry);
        }
        const onSync = (entries) => {
            console.log(entries);
            setEntries(entries);
        }
        registerSocket(config.socketEndpoint, onMessage, onSync);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [config]);

    useEffect(() => {
        if (entries.length === 0) return;
        if (entries.every(item => !!item.translation)) return;

        const untranslated = entries.filter((entry) => !entry.translation);
        if (untranslated.length === 0) return;

        const translateEntries = async () => {
            const translated = await Promise.all(entries.map(async (entry) => {
                if (!entry.translation) {
                    entry.translation = await translate(entry.text, language, translateLanguage, status, setStatus);
                    sendMessage && sendMessage(entry);
                }
                return entry;
            }));
            setEntries(translated);
        }

        translateEntries();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [entries]);

    useEffect(() => {
        if (!recognizedText) return;
        const entry = buildMessage(name, recognizedText, language, translateLanguage);
        setEntries([entry, ...entries])
        setRecognizingText('');
        setStatus((status | Status.LISTENING) & ~Status.RECOGNIZING);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [recognizedText]);

    useEffect(() => {
        if (!recognizingText) return;
        setStatus(status | Status.RECOGNIZING);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [recognizingText]);

    function handleSummarizeClick() {
        summarize(name, entries, language, status, setStatus)
            .then((result) => {
                setSummarization(result);
            });
    }

    async function handleStartSttClick() {
        setStatus(Status.INITIALIZING);
        await startSttFromMic(language, setRecognizingText, setRecognizedText, status, setStatus);
        setStatus(Status.LISTENING);
    }

    async function handleStopSttClick() {
        setStatus(Status.STOPPING);
        await stopSttFromMic(stopSttFromMic);
        setStatus(Status.IDLE);
    }

    return (
        <Box>
            <Grid container spacing={4}>
                <Grid item xs={12}>
                    <Typography variant="h4" component="div" gutterBottom paddingLeft={2}>
                        The Client-Side of Azure AI Services
                    </Typography>
                </Grid>
                <Grid item xs={12}>
                    <Stack spacing={4} direction="row" maxWidth={200}>
                        <Name value={name} lalbel="Name" onChange={setName} fullWidth />
                        <Language
                            lalbel="Spoken language"
                            value={language}
                            onChange={setLanguage}
                        />
                        <Language
                            lalbel="Translated language"
                            value={translateLanguage}
                            onChange={setTranslateLanguage}
                        />
                    </Stack>
                </Grid>
                <Grid item xs={12}>
                    <Stack spacing={4} direction="row" maxWidth={200}>
                        {status & Status.ACTIVE ?
                            <Button variant="outlined" startIcon={<MicNone />} onClick={async () => await handleStopSttClick()} disabled={!name && (status & Status.ACTIVE) === 0}>
                                Stop
                            </Button>
                            :
                            <Button variant="outlined" startIcon={<Mic />} onClick={async () => await handleStartSttClick()} disabled={!name && (status & Status.INACTIVE) === 0}>
                                Listen
                            </Button>
                        }
                        <Button variant="outlined" startIcon={<Summarize />} onClick={handleSummarizeClick} disabled={entries.length < 1}>
                            Summarize
                        </Button>
                        <Button variant="outlined" startIcon={<SyncAlt />} onClick={syncMessages} disabled={entries.length < 1}>
                            Sync
                        </Button>
                        <Button variant="outlined" startIcon={<DeleteSweep />} onClick={clearMessages} disabled={entries.length < 1}>
                            Clear
                        </Button>
                    </Stack>
                </Grid>
                <Grid item xs={12}>
                    <Chat entries={entries} name={name} />
                </Grid>
                <Grid item xs={5}>
                    {(status & Status.ACTIVE) !== 0 && (status & Status.RECOGNIZING ? <LinearProgress /> : <LinearProgress variant="determinate" value={0} />)}
                    {(status & Status.ACTIVE || status === Status.TRANSLATING) && <TextField
                        id="outlined-multiline-static"
                        label="Listening..."
                        multiline
                        rows={2}
                        value={recognizingText}
                        fullWidth
                        error={!!(status & Status.NOMATCH)}
                        helperText={status & Status.NOMATCH ? 'No natch, try again' : ''}
                    />}
                </Grid>
                <Grid item xs={7}>
                    {(status & Status.SUMMARIZING) ? <LinearProgress /> : <LinearProgress variant="determinate" value={0} />}
                    {summarization.length > 0 && <Summarization result={summarization} />}
                </Grid>
            </Grid>
        </Box>
    );
}
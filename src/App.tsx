import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  Grid,
  IconButton,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  SelectChangeEvent,
  TextField,
  Typography,
  Badge,
  Switch,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';

/**
 * Frontend dashboard:
 * - Left: All Notifications (paginated)
 * - Right: Priority Inbox (top N computed live)
 *
 * Uses Material UI for styling. No console logging.
 * Custom logger sends POST to evaluation log endpoint.
 */

type Notification = {
  id: string;
  notification_type?: string;
  title?: string;
  body?: string;
  created_at?: string;
  [key: string]: any;
};

// Use relative paths so the dev server can proxy requests to the evaluation host
const NOTIFICATIONS_ENDPOINT = '/evaluation-service/notifications';
const LOG_ENDPOINT = '/evaluation-service/logs';

/* ---------- Logging helper (no console.log) ---------- */

type LogPayload = {
  stack: 'frontend';
  level: 'info' | 'error';
  package: 'api' | 'component' | 'state';
  message: string;
};

async function sendLog(payload: LogPayload): Promise<void> {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    try {
      const t = localStorage.getItem('authToken');
      if (t) headers.Authorization = t;
    } catch {
      // ignore localStorage issues
    }
    await fetch(LOG_ENDPOINT, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
  } catch {
    // swallow errors silently to avoid leaking sensitive details
  }
}

/* Priority algorithm imported from module to keep HMR stable */
import { computePriorityInbox } from './lib/priority';

/* ---------- UI Component ---------- */

export default function App(): JSX.Element {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [filterType, setFilterType] = useState<string>('all');
  const [topN, setTopN] = useState<number>(5);
  const [authToken, setAuthToken] = useState<string>(() => {
    try {
      return localStorage.getItem('authToken') ?? '';
    } catch {
      return '';
    }
  });
  const [useMockData, setUseMockData] = useState<boolean>(false);

  const sampleNotifications: Notification[] = [
    {
      id: 'mock-1',
      notification_type: 'Placements',
      title: 'New placement matched',
      body: 'A candidate matched your placement criteria',
      created_at: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    },
    {
      id: 'mock-2',
      notification_type: 'Results',
      title: 'Results available',
      body: 'Your report results are ready',
      created_at: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    },
    {
      id: 'mock-3',
      notification_type: 'Events',
      title: 'Event reminder',
      body: 'Reminder for upcoming event',
      created_at: new Date().toISOString(),
    },
    {
      id: 'mock-4',
      notification_type: 'Placements',
      title: 'Placement update',
      body: 'Status changed to interview',
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    },
  ];

  const [page, setPage] = useState<number>(1);
  const pageSize = 8;

  const [readIds, setReadIds] = useState<Record<string, boolean>>({});

  /* Fetch notifications once on mount */
  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setFetchError(null);
    const doFetch = async () => {
      try {
        const res = await fetch(NOTIFICATIONS_ENDPOINT, {
          headers: authToken ? { Authorization: authToken } : undefined,
        });

        if (!res.ok) {
          // try to parse error body for clearer message
          let bodyMsg = '';
          try {
            const json = await res.json();
            if (json && json.message) bodyMsg = String(json.message);
          } catch {}
          const errMsg = `network:${res.status}${bodyMsg ? ':' + bodyMsg : ''}`;
          throw new Error(errMsg);
        }

        const data = await res.json();
      } catch (err: any) {
        if (!mounted) return;
        setLoading(false);
        const message = String(err?.message ?? 'fetch_error');
        setFetchError(message);
        sendLog({
          stack: 'frontend',
          level: 'error',
          package: 'api',
          message: `Failed to fetch notifications: ${message}`,
        });
      }
    };

    doFetch();

    return () => {
      mounted = false;
    };
  }, []);

  const retryFetch = () => {
    setLoading(true);
    setFetchError(null);
    // trigger a remount-style refetch by calling the same effect logic
    // simplest: reload notifications by re-running the effect via a key change
    // but to avoid reshaping effect, do a direct fetch here
    (async () => {
      try {
        const res = await fetch(NOTIFICATIONS_ENDPOINT, {
          headers: authToken ? { Authorization: authToken } : undefined,
        });
        if (!res.ok) {
          let bodyMsg = '';
          try {
            const json = await res.json();
            if (json && json.message) bodyMsg = String(json.message);
          } catch {}
          throw new Error(`network:${res.status}${bodyMsg ? ':' + bodyMsg : ''}`);
        }
        const data = await res.json();
        const arr = Array.isArray(data) ? data : (data?.notifications ?? []);
        setNotifications(arr as Notification[]);
        setLoading(false);
        sendLog({ stack: 'frontend', level: 'info', package: 'api', message: `Refetched ${arr.length} notifications` });
      } catch (err: any) {
        setLoading(false);
        const message = String(err?.message ?? 'fetch_error');
        setFetchError(message);
        sendLog({ stack: 'frontend', level: 'error', package: 'api', message: `Retry failed: ${message}` });
      }
    })();
  };

  /* Derived: distinct notification types for the dropdown */
  const availableTypes = useMemo(() => {
    const s = new Set<string>();
    notifications.forEach((n) => {
      const t = (n.notification_type ?? 'unknown').toString();
      if (t) s.add(t);
    });
    return ['all', ...Array.from(s).sort()];
  }, [notifications]);

  /* When filter changes, reset page and log */
  const handleFilterChange = (e: SelectChangeEvent<string>) => {
    const v = e.target.value as string;
    setFilterType(v);
    setPage(1);
    sendLog({
      stack: 'frontend',
      level: 'info',
      package: 'component',
      message: `Filter changed to: ${v}`,
    });
  };

  const handleTopNChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Math.max(0, Number(e.target.value || 0));
    setTopN(v);
    sendLog({
      stack: 'frontend',
      level: 'info',
      package: 'component',
      message: `Priority inbox limit set to ${v}`,
    });
  };

  /* Toggle read state for a notification */
  const toggleRead = (id: string) => {
    setReadIds((prev) => {
      const next = { ...prev, [id]: true };
      sendLog({
        stack: 'frontend',
        level: 'info',
        package: 'state',
        message: `Marked read: ${id}`,
      });
      return next;
    });
  };

  /* Filtered list according to dropdown */
  const filtered = useMemo(() => {
    if (filterType === 'all') return notifications;
    return notifications.filter((n) => {
      const t = (n.notification_type ?? '').toString();
      return t === filterType;
    });
  }, [notifications, filterType]);

  /* Priority inbox computed live using the Stage 1 algorithm */
  const priorityList = useMemo(() => computePriorityInbox(filtered, topN), [filtered, topN]);

  /* Pagination for All Notifications */
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pagedNotifications = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  /* Pagination controls */
  const goPrev = () => {
    setPage((p) => Math.max(1, p - 1));
  };
  const goNext = () => {
    setPage((p) => Math.min(totalPages, p + 1));
  };

  return (
    <Box sx={{ p: 3, backgroundColor: '#f7f8fa', minHeight: '100vh' }}>
      <Typography variant="h5" sx={{ mb: 2 }}>
        Notifications Dashboard
      </Typography>

      <Grid container spacing={2}>
        {/* Left column: All Notifications */}
        <Grid item xs={12} md={7}>
          <Paper sx={{ p: 2, height: '80vh', display: 'flex', flexDirection: 'column' }} elevation={2}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="h6">All Notifications</Typography>

              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <Select value={filterType} size="small" onChange={handleFilterChange}>
                  {availableTypes.map((t) => (
                    <MenuItem key={t} value={t}>
                      {t === 'all' ? 'All types' : t}
                    </MenuItem>
                  ))}
                </Select>

                <TextField
                  label="Top N"
                  type="number"
                  size="small"
                  inputProps={{ min: 0 }}
                  value={topN}
                  onChange={handleTopNChange}
                  sx={{ width: 100 }}
                />

                <TextField
                  label="Auth Token"
                  type="password"
                  size="small"
                  value={authToken}
                  onChange={(e) => {
                    const v = e.target.value;
                    setAuthToken(v);
                    try {
                      localStorage.setItem('authToken', v);
                    } catch {}
                    sendLog({
                      stack: 'frontend',
                      level: 'info',
                      package: 'component',
                      message: `Auth token updated (length=${v.length})`,
                    });
                  }}
                  sx={{ width: 220 }}
                />
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="caption">Mock</Typography>
                  <Switch
                    checked={useMockData}
                    onChange={(_, checked) => {
                      setUseMockData(checked);
                      if (checked) {
                        setNotifications(sampleNotifications);
                        setLoading(false);
                        sendLog({ stack: 'frontend', level: 'info', package: 'component', message: 'Mock data enabled' });
                      } else {
                        // trigger refetch
                        setLoading(true);
                        setFetchError(null);
                        (async () => {
                          try {
                            const res = await fetch(NOTIFICATIONS_ENDPOINT, {
                              headers: authToken ? { Authorization: authToken } : undefined,
                            });
                            if (!res.ok) throw new Error(`network:${res.status}`);
                            const data = await res.json();
                            const arr = Array.isArray(data) ? data : (data?.notifications ?? []);
                            setNotifications(arr as Notification[]);
                            setLoading(false);
                            sendLog({ stack: 'frontend', level: 'info', package: 'api', message: `Fetched ${arr.length} notifications` });
                          } catch (err: any) {
                            setLoading(false);
                            const message = String(err?.message ?? 'fetch_error');
                            setFetchError(message);
                            sendLog({ stack: 'frontend', level: 'error', package: 'api', message: `Failed to fetch: ${message}` });
                          }
                        })();
                      }
                    }}
                    inputProps={{ 'aria-label': 'Use mock data' }}
                    size="small"
                  />
                </Box>
              </Box>
            </Box>

            <Box sx={{ flex: 1, overflow: 'auto' }}>
              {loading ? (
                <Typography variant="body2">Loading notifications…</Typography>
              ) : fetchError ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Typography color="error" variant="body2">
                    {`Error: ${fetchError}`}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    <Button size="small" variant="outlined" onClick={retryFetch}>
                      Retry
                    </Button>
                    {fetchError.includes('401') || /authorization/i.test(fetchError) ? (
                      <Typography variant="caption" color="text.secondary">
                        Authorization required — enter a valid token in the Auth Token field
                      </Typography>
                    ) : null}
                  </Box>
                </Box>
              ) : pagedNotifications.length === 0 ? (
                <Typography variant="body2">No notifications found.</Typography>
              ) : (
                <List disablePadding>
                  {pagedNotifications.map((n) => {
                    const read = Boolean(readIds[n.id]);
                    return (
                      <ListItem
                        button
                        key={n.id}
                        onClick={() => toggleRead(n.id)}
                        sx={{
                          opacity: read ? 0.52 : 1,
                          borderBottom: '1px solid',
                          borderColor: 'divider',
                        }}
                      >
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                              <Typography sx={{ fontWeight: 600 }}>{n.title ?? 'Untitled'}</Typography>
                              <Chip label={n.notification_type ?? 'unknown'} size="small" />
                              {read && <Chip label="Viewed" size="small" color="default" />}
                            </Box>
                          }
                          secondary={
                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                              <Typography variant="body2" color="text.secondary">
                                {n.body ?? ''}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {n.created_at ? new Date(n.created_at).toLocaleString() : '—'}
                              </Typography>
                            </Box>
                          }
                        />
                      </ListItem>
                    );
                  })}
                </List>
              )}
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 1 }}>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <IconButton onClick={goPrev} disabled={page <= 1} aria-label="previous page">
                  <ArrowBackIcon />
                </IconButton>
                <IconButton onClick={goNext} disabled={page >= totalPages} aria-label="next page">
                  <ArrowForwardIcon />
                </IconButton>
                <Typography variant="body2" sx={{ alignSelf: 'center' }}>
                  Page {page} / {totalPages}
                </Typography>
              </Box>

              <Typography variant="body2" color="text.secondary">
                Showing {pagedNotifications.length} of {filtered.length}
              </Typography>
            </Box>
          </Paper>
        </Grid>

        {/* Right column: Priority Inbox */}
        <Grid item xs={12} md={5}>
          <Paper sx={{ p: 2, height: '80vh', display: 'flex', flexDirection: 'column' }} elevation={2}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="h6">Priority Inbox</Typography>
              <Badge badgeContent={priorityList.length} color="primary" />
            </Box>

            <Box sx={{ flex: 1, overflow: 'auto' }}>
              {priorityList.length === 0 ? (
                <Typography variant="body2">No priority items to show.</Typography>
              ) : (
                <List disablePadding>
                  {priorityList.map((n) => {
                    const read = Boolean(readIds[n.id]);
                    return (
                      <ListItem
                        key={n.id}
                        button
                        onClick={() => toggleRead(n.id)}
                        sx={{
                          opacity: read ? 0.5 : 1,
                          borderBottom: '1px solid',
                          borderColor: 'divider',
                        }}
                      >
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography sx={{ fontWeight: 700 }}>{n.title ?? 'Untitled'}</Typography>
                              <Chip label={n.notification_type ?? 'unknown'} size="small" />
                              {read && <Chip label="Viewed" size="small" color="default" />}
                            </Box>
                          }
                          secondary={
                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                              <Typography variant="body2" color="text.secondary">
                                {n.body ?? ''}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {n.created_at ? new Date(n.created_at).toLocaleString() : '—'}
                              </Typography>
                            </Box>
                          }
                        />
                      </ListItem>
                    );
                  })}
                </List>
              )}
            </Box>

            <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
              <Button
                variant="outlined"
                size="small"
                onClick={() => {
                  // quick action: expand topN
                  setTopN((v) => Math.min(50, v + 5));
                  sendLog({
                    stack: 'frontend',
                    level: 'info',
                    package: 'component',
                    message: 'Priority inbox expanded via quick action',
                  });
                }}
              >
                Expand
              </Button>

              <Button
                variant="text"
                size="small"
                onClick={() => {
                  setTopN(5);
                  sendLog({
                    stack: 'frontend',
                    level: 'info',
                    package: 'component',
                    message: 'Priority inbox reset to 5',
                  });
                }}
              >
                Reset
              </Button>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

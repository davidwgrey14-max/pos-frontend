// src/components/SessionStatus.jsx
import React, { useState } from 'react';
import { useSecurity } from '../contexts/SecurityContext';
import {
  Box,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  Typography,
  Tooltip,
  Badge,
  ListItemIcon,
  ListItemText,
  Divider,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemAvatar,
  Avatar,
  Switch,
  FormControlLabel
} from '@mui/material';
import {
  AccessTime,
  Logout,
  Refresh,
  Devices,
  Security,
  Verified,
  Warning,
  CheckCircle,
  Circle,
  MoreVert,
  DeviceHub,
  Computer,
  PhoneAndroid,
  Tablet
} from '@mui/icons-material';
import { authAPI } from '../services/api';

const SessionStatus = () => {
  const { 
    timeRemaining, 
    isSessionExpiring, 
    user, 
    logout, 
    refreshSession,
    extendSession 
  } = useSecurity();
  
  const [anchorEl, setAnchorEl] = useState(null);
  const [showDevices, setShowDevices] = useState(false);
  const [devices, setDevices] = useState([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [showSessionDialog, setShowSessionDialog] = useState(false);

  const handleMenuOpen = (event) => setAnchorEl(event.currentTarget);
  const handleMenuClose = () => setAnchorEl(null);

  const handleRefreshSession = async () => {
    const success = await refreshSession();
    if (success) {
      setShowSessionDialog(true);
      setTimeout(() => setShowSessionDialog(false), 3000);
    }
    handleMenuClose();
  };

  const handleLogout = () => {
    handleMenuClose();
    logout('manual');
  };

  const handleShowDevices = async () => {
    handleMenuClose();
    setShowDevices(true);
    setLoadingDevices(true);
    try {
      const response = await authAPI.getDevices();
      if (response.success) {
        setDevices(response.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch devices:', error);
    } finally {
      setLoadingDevices(false);
    }
  };

  const handleRevokeDevice = async (deviceId) => {
    try {
      await authAPI.revokeDevice(deviceId);
      // Refresh devices list
      const response = await authAPI.getDevices();
      if (response.success) {
        setDevices(response.data || []);
      }
    } catch (error) {
      console.error('Failed to revoke device:', error);
    }
  };

  const getDeviceIcon = (deviceType) => {
    switch (deviceType) {
      case 'mobile': return <PhoneAndroid />;
      case 'tablet': return <Tablet />;
      default: return <Computer />;
    }
  };

  const getTimeColor = () => {
    if (timeRemaining <= 10) return 'error';
    if (timeRemaining <= 30) return 'warning';
    return 'success';
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {/* Session Timer */}
        <Tooltip title={`Session expires in ${formatTime(timeRemaining)}`}>
          <Chip
            icon={<AccessTime />}
            label={formatTime(timeRemaining)}
            color={getTimeColor()}
            size="small"
            sx={{ 
              minWidth: 70,
              '& .MuiChip-label': { fontWeight: 'bold' },
              animation: isSessionExpiring ? 'pulse 1s infinite' : 'none',
              '@keyframes pulse': {
                '0%': { opacity: 1 },
                '50%': { opacity: 0.5 },
                '100%': { opacity: 1 }
              }
            }}
          />
        </Tooltip>

        {/* User Menu */}
        <IconButton onClick={handleMenuOpen} size="small">
          <Badge 
            color="success" 
            variant="dot" 
            overlap="circular"
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          >
            <Avatar 
              sx={{ 
                width: 32, 
                height: 32,
                bgcolor: 'primary.main',
                fontSize: '0.875rem'
              }}
            >
              {user?.name?.charAt(0)?.toUpperCase() || 'U'}
            </Avatar>
          </Badge>
        </IconButton>
      </Box>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        PaperProps={{
          sx: { width: 280, maxWidth: '100%' }
        }}
      >
        <MenuItem disabled>
          <Box sx={{ width: '100%' }}>
            <Typography variant="subtitle2" noWrap>
              {user?.name || 'User'}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              {user?.email || ''}
            </Typography>
            <Typography variant="caption" display="block" color="text.secondary">
              Role: {user?.role || 'Admin'}
            </Typography>
          </Box>
        </MenuItem>
        
        <Divider />
        
        <MenuItem onClick={handleRefreshSession}>
          <ListItemIcon>
            <Refresh fontSize="small" />
          </ListItemIcon>
          <ListItemText>Refresh Session</ListItemText>
        </MenuItem>
        
        <MenuItem onClick={handleShowDevices}>
          <ListItemIcon>
            <Devices fontSize="small" />
          </ListItemIcon>
          <ListItemText>Manage Devices</ListItemText>
        </MenuItem>
        
        <MenuItem onClick={handleLogout}>
          <ListItemIcon>
            <Logout fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText sx={{ color: 'error.main' }}>Logout</ListItemText>
        </MenuItem>
      </Menu>

      {/* Session Refresh Dialog */}
      <Dialog open={showSessionDialog} onClose={() => setShowSessionDialog(false)} maxWidth="xs">
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CheckCircle color="success" />
          Session Refreshed
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Your session has been successfully extended. You have {timeRemaining} seconds remaining.
          </Typography>
          <LinearProgress 
            variant="determinate" 
            value={(timeRemaining / 60) * 100} 
            sx={{ mt: 2, height: 6, borderRadius: 3 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowSessionDialog(false)}>OK</Button>
        </DialogActions>
      </Dialog>

      {/* Devices Dialog */}
      <Dialog 
        open={showDevices} 
        onClose={() => setShowDevices(false)} 
        maxWidth="sm" 
        fullWidth
      >
        <DialogTitle>Manage Devices</DialogTitle>
        <DialogContent>
          {loadingDevices ? (
            <Box sx={{ py: 4, display: 'flex', justifyContent: 'center' }}>
              <CircularProgress />
            </Box>
          ) : devices.length === 0 ? (
            <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
              No devices found
            </Typography>
          ) : (
            <List>
              {devices.map((device) => (
                <ListItem
                  key={device.id}
                  secondaryAction={
                    !device.isCurrent && (
                      <Button
                        size="small"
                        color="error"
                        onClick={() => handleRevokeDevice(device.id)}
                      >
                        Revoke
                      </Button>
                    )
                  }
                >
                  <ListItemAvatar>
                    <Avatar sx={{ bgcolor: device.isCurrent ? 'success.light' : 'grey.200' }}>
                      {getDeviceIcon(device.deviceType)}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {device.deviceName}
                        {device.isCurrent && (
                          <Chip label="Current" size="small" color="success" />
                        )}
                        {device.isVerified && (
                          <Tooltip title="Verified Device">
                            <Verified sx={{ fontSize: 16, color: 'success.main' }} />
                          </Tooltip>
                        )}
                      </Box>
                    }
                    secondary={
                      <>
                        <Typography variant="caption" display="block" color="text.secondary">
                          {device.os} • {device.browser}
                        </Typography>
                        <Typography variant="caption" display="block" color="text.secondary">
                          Last login: {new Date(device.lastLogin).toLocaleString()}
                          {device.loginCount && ` • ${device.loginCount} logins`}
                        </Typography>
                      </>
                    }
                  />
                </ListItem>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDevices(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default SessionStatus;
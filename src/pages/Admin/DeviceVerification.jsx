// src/pages/Admin/DeviceVerification.jsx

import React, { useState, useEffect } from 'react';
import {
  Container,
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  CircularProgress,
  Tabs,
  Tab,
  Avatar,
  Tooltip,
  TextField,
  Card,
  CardContent,
  Grid,
  Divider
} from '@mui/material';
import {
  CheckCircle,
  Cancel,
  Pending,
  Computer,
  PhoneAndroid,
  Laptop,
  Tablet,
  Refresh,
  Security,
  Warning,
  Email,
  Person,
  Devices,
  AccessTime
} from '@mui/icons-material';
import { adminAPI } from '../../services/api';

const DeviceVerification = () => {
  const [loading, setLoading] = useState(false);
  const [requests, setRequests] = useState([]);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [action, setAction] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [tab, setTab] = useState(0);
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({ pending: 0, total: 0 });

  const colors = {
    primary: {
      main: '#6366F1',
      light: '#818CF8',
      dark: '#4F46E5',
      gradient: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)'
    },
    admin: {
      main: '#F59E0B',
      light: '#FBBF24',
      dark: '#D97706',
      gradient: 'linear-gradient(135deg, #F59E0B 0%, #FBBF24 100%)'
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await adminAPI.getVerificationRequests();
      const data = response.data || [];
      setRequests(data);
      
      const pending = data.filter(r => r.status === 'pending').length;
      setStats({ pending, total: data.length });
    } catch (error) {
      console.error('Error fetching requests:', error);
      setError('Failed to fetch verification requests');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (requestId, action, reason = '') => {
    setLoading(true);
    setError(null);
    try {
      await adminAPI.verifyDevice({
        requestId,
        action,
        rejectionReason: reason
      });
      
      setSuccess(`Device ${action === 'approve' ? 'approved' : 'rejected'} successfully`);
      fetchRequests();
    } catch (error) {
      console.error('Error verifying device:', error);
      setError(error.response?.data?.message || 'Failed to verify device');
    } finally {
      setLoading(false);
      setDialogOpen(false);
      setRejectionReason('');
    }
  };

  const getDeviceIcon = (deviceType) => {
    switch (deviceType) {
      case 'desktop':
        return <Computer />;
      case 'laptop':
        return <Laptop />;
      case 'mobile':
        return <PhoneAndroid />;
      case 'tablet':
        return <Tablet />;
      default:
        return <Computer />;
    }
  };

  const getStatusChip = (status) => {
    switch (status) {
      case 'pending':
        return <Chip icon={<Pending />} label="Pending" color="warning" size="small" />;
      case 'approved':
        return <Chip icon={<CheckCircle />} label="Approved" color="success" size="small" />;
      case 'rejected':
        return <Chip icon={<Cancel />} label="Rejected" color="error" size="small" />;
      case 'expired':
        return <Chip icon={<Warning />} label="Expired" color="default" size="small" />;
      default:
        return <Chip label={status} size="small" />;
    }
  };

  const filteredRequests = tab === 0 
    ? requests.filter(r => r.status === 'pending')
    : requests.filter(r => r.status !== 'pending');

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'white' }}>
          Device Verification
        </Typography>
        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
          Manage device access requests from cashiers and staff
        </Typography>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={4}>
          <Card sx={{ 
            background: 'linear-gradient(135deg, #1E293B 0%, #334155 100%)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 2
          }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>
                    Total Requests
                  </Typography>
                  <Typography variant="h4" sx={{ color: 'white', fontWeight: 'bold' }}>
                    {stats.total}
                  </Typography>
                </Box>
                <Devices sx={{ fontSize: 40, color: 'rgba(99, 102, 241, 0.6)' }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card sx={{ 
            background: 'linear-gradient(135deg, #1E293B 0%, #334155 100%)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 2
          }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>
                    Pending
                  </Typography>
                  <Typography variant="h4" sx={{ color: '#F59E0B', fontWeight: 'bold' }}>
                    {stats.pending}
                  </Typography>
                </Box>
                <Pending sx={{ fontSize: 40, color: 'rgba(245, 158, 11, 0.6)' }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card sx={{ 
            background: 'linear-gradient(135deg, #1E293B 0%, #334155 100%)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 2
          }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>
                    Processed
                  </Typography>
                  <Typography variant="h4" sx={{ color: '#10B981', fontWeight: 'bold' }}>
                    {stats.total - stats.pending}
                  </Typography>
                </Box>
                <CheckCircle sx={{ fontSize: 40, color: 'rgba(16, 185, 129, 0.6)' }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {error && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      <Paper sx={{ 
        background: 'linear-gradient(135deg, #1E293B 0%, rgba(51, 65, 85, 0.9) 100%)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 2,
        overflow: 'hidden'
      }}>
        <Box sx={{ borderBottom: 1, borderColor: 'rgba(255,255,255,0.1)', px: 2 }}>
          <Tabs 
            value={tab} 
            onChange={(e, v) => setTab(v)}
            sx={{
              '& .MuiTab-root': {
                color: 'rgba(255,255,255,0.6)',
                '&.Mui-selected': {
                  color: 'white'
                }
              },
              '& .MuiTabs-indicator': {
                backgroundColor: '#F59E0B'
              }
            }}
          >
            <Tab label={`Pending (${stats.pending})`} />
            <Tab label="History" />
          </Tabs>
        </Box>

        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ color: 'rgba(255,255,255,0.7)' }}>User</TableCell>
                <TableCell sx={{ color: 'rgba(255,255,255,0.7)' }}>Device</TableCell>
                <TableCell sx={{ color: 'rgba(255,255,255,0.7)' }}>OS / Browser</TableCell>
                <TableCell sx={{ color: 'rgba(255,255,255,0.7)' }}>MAC Address</TableCell>
                <TableCell sx={{ color: 'rgba(255,255,255,0.7)' }}>Status</TableCell>
                <TableCell sx={{ color: 'rgba(255,255,255,0.7)' }}>Time</TableCell>
                <TableCell sx={{ color: 'rgba(255,255,255,0.7)' }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                    <CircularProgress size={32} />
                  </TableCell>
                </TableRow>
              ) : filteredRequests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 4, color: 'rgba(255,255,255,0.5)' }}>
                    {tab === 0 ? 'No pending verification requests' : 'No history found'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredRequests.map((request) => (
                  <TableRow key={request.id || request._id}>
                    <TableCell>
                      <Box>
                        <Typography sx={{ color: 'white' }}>
                          {request.user?.name || request.userName || 'Unknown'}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>
                          {request.user?.email || request.email || 'No email'}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {getDeviceIcon(request.device?.deviceType || request.deviceType)}
                        <Typography sx={{ color: 'white' }}>
                          {request.device?.deviceName || request.deviceName || 'Unknown Device'}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                        {request.device?.os || request.os || 'Unknown OS'}
                      </Typography>
                      <br />
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>
                        {request.device?.browser || request.browser || 'Unknown Browser'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" sx={{ 
                        color: 'rgba(255,255,255,0.7)',
                        fontFamily: 'monospace'
                      }}>
                        {request.device?.macAddress || request.macAddress || 'Unknown'}
                      </Typography>
                    </TableCell>
                    <TableCell>{getStatusChip(request.status)}</TableCell>
                    <TableCell>
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>
                        {new Date(request.createdAt || request.created).toLocaleString()}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {request.status === 'pending' && (
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <Tooltip title="Approve Device">
                            <IconButton
                              size="small"
                              sx={{ color: '#4CAF50' }}
                              onClick={() => {
                                setSelectedRequest(request);
                                setAction('approve');
                                setDialogOpen(true);
                              }}
                            >
                              <CheckCircle />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Reject Device">
                            <IconButton
                              size="small"
                              sx={{ color: '#f44336' }}
                              onClick={() => {
                                setSelectedRequest(request);
                                setAction('reject');
                                setDialogOpen(true);
                              }}
                            >
                              <Cancel />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Verification Dialog */}
      <Dialog 
        open={dialogOpen} 
        onClose={() => {
          setDialogOpen(false);
          setRejectionReason('');
        }} 
        maxWidth="sm" 
        fullWidth
        PaperProps={{
          sx: {
            background: 'linear-gradient(135deg, #1E293B 0%, #0F172A 100%)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 3
          }
        }}
      >
        <DialogTitle sx={{ 
          background: action === 'approve' ? 'linear-gradient(135deg, #10B981 0%, #34D399 100%)' : 'linear-gradient(135deg, #EF4444 0%, #F87171 100%)',
          color: 'white',
          py: 2
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {action === 'approve' ? <CheckCircle /> : <Cancel />}
            <Typography variant="h6" fontWeight="bold">
              {action === 'approve' ? 'Approve Device' : 'Reject Device'}
            </Typography>
          </Box>
        </DialogTitle>
        
        <DialogContent sx={{ mt: 2, pt: 2 }}>
          <Alert severity={action === 'approve' ? 'info' : 'warning'} sx={{ mb: 2, borderRadius: 2 }}>
            {action === 'approve' 
              ? 'Are you sure you want to approve this device?'
              : 'Are you sure you want to reject this device?'
            }
          </Alert>
          
          {selectedRequest && (
            <Paper sx={{ 
              p: 2, 
              bgcolor: 'rgba(255,255,255,0.05)',
              borderRadius: 2,
              mb: 2
            }}>
              <Typography variant="subtitle2" sx={{ color: 'rgba(255,255,255,0.7)', mb: 1 }}>
                Device Details:
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)' }}>
                  <strong>User:</strong> {selectedRequest.user?.name || 'Unknown'}
                </Typography>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)' }}>
                  <strong>Email:</strong> {selectedRequest.user?.email || 'Unknown'}
                </Typography>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)' }}>
                  <strong>Device:</strong> {selectedRequest.device?.deviceName || 'Unknown'}
                </Typography>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)' }}>
                  <strong>OS:</strong> {selectedRequest.device?.os || 'Unknown'}
                </Typography>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)', gridColumn: 'span 2' }}>
                  <strong>MAC:</strong> {selectedRequest.device?.macAddress || 'Unknown'}
                </Typography>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)', gridColumn: 'span 2' }}>
                  <strong>IP:</strong> {selectedRequest.ipAddress || selectedRequest.device?.ipAddress || 'Unknown'}
                </Typography>
              </Box>
            </Paper>
          )}
          
          {action === 'reject' && (
            <TextField
              fullWidth
              label="Rejection Reason"
              multiline
              rows={3}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Why is this device being rejected?"
              sx={{ 
                mt: 1,
                '& .MuiOutlinedInput-root': {
                  color: 'white',
                  '& fieldset': {
                    borderColor: 'rgba(255,255,255,0.2)',
                  },
                  '&:hover fieldset': {
                    borderColor: 'rgba(255,255,255,0.4)',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: '#EF4444',
                  },
                },
                '& .MuiInputLabel-root': {
                  color: 'rgba(255,255,255,0.7)',
                },
              }}
            />
          )}
        </DialogContent>
        
        <DialogActions sx={{ p: 3, pt: 0 }}>
          <Button 
            onClick={() => {
              setDialogOpen(false);
              setRejectionReason('');
            }}
            sx={{
              color: 'rgba(255,255,255,0.7)',
              '&:hover': {
                backgroundColor: 'rgba(255,255,255,0.05)'
              }
            }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color={action === 'approve' ? 'success' : 'error'}
            onClick={() => handleVerify(
              selectedRequest?.id || selectedRequest?._id,
              action,
              rejectionReason
            )}
            disabled={loading}
            sx={{
              px: 3,
              py: 1,
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 'bold'
            }}
          >
            {loading ? <CircularProgress size={24} /> : action === 'approve' ? 'Approve Device' : 'Reject Device'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default DeviceVerification;
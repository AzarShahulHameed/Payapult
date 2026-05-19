// frontend/src/api/client.js
import axios from 'axios';
import toast from 'react-hot-toast';

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({ baseURL: BASE, headers: { 'Content-Type': 'application/json' }, timeout: 15000 });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('pp_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let refreshing = false; let queue = [];
const processQueue = (err, token) => { queue.forEach(p => err ? p.reject(err) : p.resolve(token)); queue = []; };

api.interceptors.response.use(
  res => res,
  async (err) => {
    const orig = err.config;
    if (err.response?.status === 401 && !orig._retry) {
      if (refreshing) return new Promise((res, rej) => queue.push({ resolve: res, reject: rej }))
        .then(token => { orig.headers.Authorization = `Bearer ${token}`; return api(orig); });
      orig._retry = true; refreshing = true;
      const refreshToken = localStorage.getItem('pp_refresh');
      if (!refreshToken) { refreshing = false; window.location.href = '/login'; return Promise.reject(err); }
      try {
        const r = await axios.post(`${BASE}/auth/refresh`, { refreshToken });
        const newToken = r.data.token;
        localStorage.setItem('pp_token', newToken);
        processQueue(null, newToken);
        orig.headers.Authorization = `Bearer ${newToken}`;
        return api(orig);
      } catch (e) { processQueue(e, null); localStorage.clear(); window.location.href = '/login'; return Promise.reject(e); }
      finally { refreshing = false; }
    }
    if (err.response?.status !== 401) {
      toast.error(err.response?.data?.message || err.message || 'Request failed');
    }
    return Promise.reject(err);
  }
);

export default api;

export const authAPI = {
  login: d => api.post('/auth/login', d),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
  updateProfile: d => api.put('/auth/profile', d),
  changePassword: d => api.post('/auth/change-password', d),
  refresh: rt => api.post('/auth/refresh', { refreshToken: rt }),
};
export const employeesAPI = {
  list: p => api.get('/employees', { params: p }),
  get: id => api.get(`/employees/${id}`),
  create: d => api.post('/employees', d),
  update: (id, d) => api.put(`/employees/${id}`, d),
  remove: id => api.delete(`/employees/${id}`),
  payslips: id => api.get(`/employees/${id}/payslips`),
  payslip: (empId, slipId) => api.get(`/employees/${empId}/payslip/${slipId}`),
};
export const payRunsAPI = {
  list: p => api.get('/pay-runs', { params: p }),
  get: id => api.get(`/pay-runs/${id}`),
  create: d => api.post('/pay-runs', d),
  approve: id => api.post(`/pay-runs/${id}/approve`),
  markPaid: id => api.post(`/pay-runs/${id}/mark-paid`),
  recalculate: id => api.post(`/pay-runs/${id}/recalculate`),
  cancel: id => api.delete(`/pay-runs/${id}`),
  recalculate: id => api.post(`/pay-runs/${id}/recalculate`),
};
export const leaveAPI = {
  list: p => api.get('/leave', { params: p }),
  balances: p => api.get('/leave/balances', { params: p }),
  create: d => api.post('/leave', d),
  approve: id => api.post(`/leave/${id}/approve`),
  reject: (id, reason) => api.post(`/leave/${id}/reject`, { reason }),
};
export const loansAPI = {
  list: p => api.get('/loans', { params: p }),
  create: d => api.post('/loans', d),
  approve: id => api.post(`/loans/${id}/approve`),
  schedule: id => api.get(`/loans/${id}/schedule`),
};
export const advancesAPI = {
  list: () => api.get('/advances'),
  create: d => api.post('/advances', d),
  approve: id => api.post(`/advances/${id}/approve`),
  reject: id => api.post(`/advances/${id}/reject`),
};
export const analyticsAPI = {
  dashboard: () => api.get('/analytics/dashboard'),
  payroll: p => api.get('/analytics/payroll', { params: p }),
  headcount: () => api.get('/analytics/headcount'),
  report: (type, p) => api.get(`/analytics/reports/${type}`, { params: p }),
};
export const settingsAPI = {
  getOrg: () => api.get('/settings/organization'),
  updateOrg: d => api.put('/settings/organization', d),
  updateLogo: url => api.post('/settings/organization/logo', { logo_url: url }),
  getDepartments: () => api.get('/settings/departments'),
  createDept: d => api.post('/settings/departments', d),
  updateDept: (id, d) => api.put(`/settings/departments/${id}`, d),
  deleteDept: id => api.delete(`/settings/departments/${id}`),
  getDesignations: () => api.get('/settings/designations'),
  createDesig: d => api.post('/settings/designations', d),
  updateDesig: (id, d) => api.put(`/settings/designations/${id}`, d),
  deleteDesig: id => api.delete(`/settings/designations/${id}`),
  getWorkLocations: () => api.get('/settings/work-locations'),
  createWL: d => api.post('/settings/work-locations', d),
  updateWL: (id, d) => api.put(`/settings/work-locations/${id}`, d),
  deleteWL: id => api.delete(`/settings/work-locations/${id}`),
  getSalaryComponents: () => api.get('/settings/salary-components'),
  createComp: d => api.post('/settings/salary-components', d),
  updateComp: (id, d) => api.put(`/settings/salary-components/${id}`, d),
  deleteComp: id => api.delete(`/settings/salary-components/${id}`),
  getLeavePolicies: () => api.get('/settings/leave-policies'),
  createPolicy: d => api.post('/settings/leave-policies', d),
  updatePolicy: (id, d) => api.put(`/settings/leave-policies/${id}`, d),
  deletePolicy: id => api.delete(`/settings/leave-policies/${id}`),
  getUsers: () => api.get('/settings/users'),
  createUser: d => api.post('/settings/users', d),
  updateUser: (id, d) => api.put(`/settings/users/${id}`, d),
  deleteUser: id => api.delete(`/settings/users/${id}`),
};

// File upload helpers
export const uploadAPI = {
  logo: (file) => {
    const fd = new FormData(); fd.append('logo', file);
    return api.post('/settings/upload/logo/cloud', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  avatar: (file) => {
    const fd = new FormData(); fd.append('avatar', file);
    return api.post('/settings/upload/avatar/cloud', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  employeePhoto: (empId, file) => {
    const fd = new FormData(); fd.append('photo', file);
    return api.post(`/settings/upload/employee-photo/${empId}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
};

export const certsAPI = {
  list: (empId) => api.get(`/documents/certificates/${empId}`),
  create: (empId, fd) => api.post(`/documents/certificates/${empId}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } }),
  update: (id, fd) => api.put(`/documents/certificates/${id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } }),
  remove: (id) => api.delete(`/documents/certificates/${id}`),
};

export const templatesAPI = {
  list: () => api.get('/documents/templates'),
  create: (fd) => api.post('/documents/templates', fd, { headers: { 'Content-Type': 'multipart/form-data' } }),
  importData: (fd) => api.post('/documents/templates/import', fd, { headers: { 'Content-Type': 'multipart/form-data' } }),
  remove: (id) => api.delete(`/documents/templates/${id}`),
};

// Add recalculate to payRunsAPI
// Usage: payRunsAPI.recalculate(id)

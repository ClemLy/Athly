import API from '../api/api';
import { saveToken, removeToken } from '../utils/authStorage';

export async function login(email, password) {
  const res = await API.post('/auth/login', { email, password });
  if (res.data?.token) await saveToken(res.data.token);
  return res.data;
}

export async function register(data) {
  const res = await API.post('/auth/register', data);
  if (res.data?.token) await saveToken(res.data.token);
  return res.data;
}

export async function logout() {
  await removeToken();
}

export async function verifyEmail(email, code) {
  const res = await API.post('/auth/verify-email', { email, code });
  return res.data;
}

export async function resendVerificationEmail(email) {
  const res = await API.post('/auth/resend-verification', { email });
  return res.data;
}

export async function forgotPassword(email) {
  const res = await API.post('/auth/forgot-password', { email });
  return res.data;
}

export async function resetPassword(email, code, newPassword) {
  const res = await API.post('/auth/reset-password', { email, code, newPassword });
  return res.data;
}

export async function deleteAccount() {
  const res = await API.delete('/users/delete-account');
  return res.data;
}

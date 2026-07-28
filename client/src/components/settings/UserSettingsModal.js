'use client';
import { useState, useRef, useEffect } from 'react';
import api, { getMediaUrl } from '../../lib/api';
import { useAuthStore } from '../../lib/stores/authStore';
import Avatar from '../ui/Avatar';

const TABS = ['Profile', 'About Me', 'Security'];

export default function UserSettingsModal({ onClose }) {
  const { user, setUser } = useAuthStore();
  const [activeTab, setActiveTab] = useState('Profile');

  // Profile tab state
  const [username, setUsername] = useState(user?.username || '');
  const [avatarPreview, setAvatarPreview] = useState(getMediaUrl(user?.avatar_url));
  const [avatarFile, setAvatarFile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');
  const fileInputRef = useRef(null);

  // About Me tab state
  const [bio, setBio] = useState(user?.bio || '');
  const [pronouns, setPronouns] = useState(user?.pronouns || '');
  const [location, setLocation] = useState(user?.location || '');
  const [bannerColor, setBannerColor] = useState(user?.banner_color || '#5865F2');
  const [aboutLoading, setAboutLoading] = useState(false);
  const [aboutError, setAboutError] = useState('');
  const [aboutSuccess, setAboutSuccess] = useState('');

  // Security — email tab state
  const [newEmail, setNewEmail] = useState(user?.email || '');
  const [emailPassword, setEmailPassword] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [emailSuccess, setEmailSuccess] = useState('');

  // Security — password tab state
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');

  // Fetch fresh profile data on mount so About Me fields always reflect saved values
  useEffect(() => {
    api.get('/users/me').then(({ data }) => {
      setBio(data.bio || '');
      setPronouns(data.pronouns || '');
      setLocation(data.location || '');
      setBannerColor(data.banner_color || '#5865F2');
      setUser({ ...useAuthStore.getState().user, ...data });
    }).catch(() => {});
  }, []);

  function handleAvatarPick(e) {
    const file = e.target.files[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  }

  const [removeAvatar, setRemoveAvatar] = useState(false);

  async function handleRemoveAvatar() {
    setProfileError('');
    setProfileSuccess('');
    setAvatarFile(null);
    setAvatarPreview(null);
    setRemoveAvatar(true);
  }

  async function handleProfileSave(e) {
    e.preventDefault();
    setProfileError('');
    setProfileSuccess('');
    setProfileLoading(true);
    try {
      let updated = user;
      // Remove avatar if requested
      if (removeAvatar) {
        const { data } = await api.patch('/users/me', { avatar_url: null });
        updated = { ...updated, ...data };
        setRemoveAvatar(false);
      } else if (avatarFile) {
        // Upload avatar if changed
        const fd = new FormData();
        fd.append('avatar', avatarFile);
        const { data } = await api.post('/users/me/avatar', fd);
        updated = { ...updated, ...data };
      }
      // Update username if changed
      if (username !== user.username) {
        const { data } = await api.patch('/users/me', { username });
        updated = { ...updated, ...data };
      }
      setUser({ ...user, ...updated });
      setProfileSuccess('Profile updated!');
      setAvatarFile(null);
    } catch (err) {
      setProfileError(err.response?.data?.error || 'Failed to update profile');
    } finally {
      setProfileLoading(false);
    }
  }

  async function handleEmailSave(e) {
    e.preventDefault();
    setEmailError('');
    setEmailSuccess('');
    setEmailLoading(true);
    try {
      const { data } = await api.patch('/users/me/email', { email: newEmail, currentPassword: emailPassword });
      setUser({ ...user, ...data });
      setEmailPassword('');
      setEmailSuccess('Email updated!');
    } catch (err) {
      setEmailError(err.response?.data?.error || 'Failed to update email');
    } finally {
      setEmailLoading(false);
    }
  }

  async function handlePasswordSave(e) {
    e.preventDefault();
    setPwError('');
    setPwSuccess('');
    if (newPw !== confirmPw) return setPwError('New passwords do not match');
    if (newPw.length < 6) return setPwError('Password must be at least 6 characters');
    setPwLoading(true);
    try {
      await api.patch('/users/me/password', { currentPassword: currentPw, newPassword: newPw });
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
      setPwSuccess('Password changed!');
    } catch (err) {
      setPwError(err.response?.data?.error || 'Failed to change password');
    } finally {
      setPwLoading(false);
    }
  }

  async function handleAboutSave(e) {
    e.preventDefault();
    setAboutError('');
    setAboutSuccess('');
    setAboutLoading(true);
    try {
      const { data } = await api.patch('/users/me/profile', { bio, pronouns, location, banner_color: bannerColor });
      setUser({ ...user, ...data });
      setAboutSuccess('Profile updated!');
    } catch (err) {
      setAboutError(err.response?.data?.error || 'Failed to update profile');
    } finally {
      setAboutLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-discord-sidebar rounded-lg shadow-2xl w-full max-w-lg flex flex-col overflow-hidden"
        style={{ maxHeight: '90vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-discord-darker/50">
          <h2 className="text-white font-bold text-lg">User Settings</h2>
          <button onClick={onClose} className="text-discord-muted hover:text-white transition-colors text-xl leading-none">✕</button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-6 pt-3">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 rounded text-sm font-semibold transition-colors ${
                activeTab === tab
                  ? 'bg-discord-input text-white'
                  : 'text-discord-muted hover:text-white'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {activeTab === 'Profile' && (
            <form onSubmit={handleProfileSave} className="flex flex-col gap-5">
              {/* Avatar picker */}
              <div className="flex flex-col items-center gap-3">
                <div
                  className="relative cursor-pointer group"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {avatarPreview ? (
                    <img
                      src={avatarPreview}
                      alt="avatar"
                      className="w-20 h-20 rounded-full object-cover"
                    />
                  ) : (
                    <Avatar username={user?.username || '?'} size={80} />
                  )}
                  <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                    </svg>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-discord-muted text-xs">Click to change avatar</p>
                  {(avatarPreview) && (
                    <button
                      type="button"
                      onClick={handleRemoveAvatar}
                      className="text-discord-red hover:text-red-400 text-xs transition-colors"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarPick} />
              </div>

              {/* Username */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-discord-muted uppercase tracking-wide">Username</label>
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="bg-discord-darker rounded p-2.5 text-discord-text border border-transparent focus:border-discord-blurple focus:outline-none"
                />
              </div>

              {profileError && <p className="text-discord-red text-sm">{profileError}</p>}
              {profileSuccess && <p className="text-discord-green text-sm">{profileSuccess}</p>}

              <button
                type="submit"
                disabled={profileLoading}
                className="bg-discord-blurple hover:bg-blue-500 text-white font-semibold rounded py-2 transition-colors disabled:opacity-60"
              >
                {profileLoading ? 'Saving...' : 'Save Changes'}
              </button>
            </form>
          )}

          {activeTab === 'About Me' && (
            <form onSubmit={handleAboutSave} className="flex flex-col gap-5">
              {/* Banner color */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-discord-muted uppercase tracking-wide">Banner Color</label>
                <div className="flex items-center gap-3">
                  <div className="w-full h-16 rounded-lg" style={{ backgroundColor: bannerColor }} />
                  <input
                    type="color"
                    value={bannerColor}
                    onChange={(e) => setBannerColor(e.target.value)}
                    className="w-10 h-10 rounded cursor-pointer border-0 bg-transparent"
                  />
                </div>
              </div>

              {/* Bio */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-discord-muted uppercase tracking-wide">Bio</label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  maxLength={500}
                  rows={4}
                  placeholder="Tell people a little about yourself..."
                  className="bg-discord-darker rounded p-2.5 text-discord-text border border-transparent focus:border-discord-blurple focus:outline-none resize-none"
                />
                <p className="text-discord-muted text-xs text-right">{bio.length}/500</p>
              </div>

              {/* Pronouns */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-discord-muted uppercase tracking-wide">Pronouns</label>
                <input
                  value={pronouns}
                  onChange={(e) => setPronouns(e.target.value)}
                  maxLength={40}
                  placeholder="e.g. he/him, she/her, they/them"
                  className="bg-discord-darker rounded p-2.5 text-discord-text border border-transparent focus:border-discord-blurple focus:outline-none"
                />
              </div>

              {/* Location */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-discord-muted uppercase tracking-wide">Location</label>
                <input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  maxLength={100}
                  placeholder="Where are you based?"
                  className="bg-discord-darker rounded p-2.5 text-discord-text border border-transparent focus:border-discord-blurple focus:outline-none"
                />
              </div>

              {aboutError && <p className="text-discord-red text-sm">{aboutError}</p>}
              {aboutSuccess && <p className="text-discord-green text-sm">{aboutSuccess}</p>}

              <button
                type="submit"
                disabled={aboutLoading}
                className="bg-discord-blurple hover:bg-blue-500 text-white font-semibold rounded py-2 transition-colors disabled:opacity-60"
              >
                {aboutLoading ? 'Saving...' : 'Save Changes'}
              </button>
            </form>
          )}

          {activeTab === 'Security' && (
            <div className="flex flex-col gap-6">
              {/* Change email */}
              <form onSubmit={handleEmailSave} className="flex flex-col gap-3">
                <h3 className="text-white font-semibold text-sm">Change Email</h3>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-discord-muted uppercase tracking-wide">New Email</label>
                  <input
                    type="email"
                    required
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="bg-discord-darker rounded p-2.5 text-discord-text border border-transparent focus:border-discord-blurple focus:outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-discord-muted uppercase tracking-wide">Current Password</label>
                  <input
                    type="password"
                    required
                    value={emailPassword}
                    onChange={(e) => setEmailPassword(e.target.value)}
                    className="bg-discord-darker rounded p-2.5 text-discord-text border border-transparent focus:border-discord-blurple focus:outline-none"
                  />
                </div>
                {emailError && <p className="text-discord-red text-sm">{emailError}</p>}
                {emailSuccess && <p className="text-discord-green text-sm">{emailSuccess}</p>}
                <button
                  type="submit"
                  disabled={emailLoading}
                  className="bg-discord-blurple hover:bg-blue-500 text-white font-semibold rounded py-2 transition-colors disabled:opacity-60"
                >
                  {emailLoading ? 'Updating...' : 'Update Email'}
                </button>
              </form>

              <div className="border-t border-discord-darker/50" />

              {/* Change password */}
              <form onSubmit={handlePasswordSave} className="flex flex-col gap-3">
                <h3 className="text-white font-semibold text-sm">Change Password</h3>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-discord-muted uppercase tracking-wide">Current Password</label>
                  <input
                    type="password"
                    required
                    value={currentPw}
                    onChange={(e) => setCurrentPw(e.target.value)}
                    className="bg-discord-darker rounded p-2.5 text-discord-text border border-transparent focus:border-discord-blurple focus:outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-discord-muted uppercase tracking-wide">New Password</label>
                  <input
                    type="password"
                    required
                    value={newPw}
                    onChange={(e) => setNewPw(e.target.value)}
                    className="bg-discord-darker rounded p-2.5 text-discord-text border border-transparent focus:border-discord-blurple focus:outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-discord-muted uppercase tracking-wide">Confirm New Password</label>
                  <input
                    type="password"
                    required
                    value={confirmPw}
                    onChange={(e) => setConfirmPw(e.target.value)}
                    className="bg-discord-darker rounded p-2.5 text-discord-text border border-transparent focus:border-discord-blurple focus:outline-none"
                  />
                </div>
                {pwError && <p className="text-discord-red text-sm">{pwError}</p>}
                {pwSuccess && <p className="text-discord-green text-sm">{pwSuccess}</p>}
                <button
                  type="submit"
                  disabled={pwLoading}
                  className="bg-discord-blurple hover:bg-blue-500 text-white font-semibold rounded py-2 transition-colors disabled:opacity-60"
                >
                  {pwLoading ? 'Changing...' : 'Change Password'}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

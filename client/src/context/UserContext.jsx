import React, { createContext, useContext, useState, useEffect } from 'react';

const UserContext = createContext(null);

function getOrCreateUserId() {
  const stored = localStorage.getItem('pd-userId');
  if (stored) return stored;
  const id = crypto.randomUUID();
  localStorage.setItem('pd-userId', id);
  return id;
}

function getStoredUserName() {
  return localStorage.getItem('pd-userName') || '';
}

export function UserProvider({ children }) {
  const [userId] = useState(getOrCreateUserId);
  const [userName, setUserNameState] = useState(getStoredUserName);

  const setUserName = (name) => {
    setUserNameState(name);
    localStorage.setItem('pd-userName', name);
  };

  const value = {
    userId,
    userName,
    setUserName,
  };

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}

export default UserContext;

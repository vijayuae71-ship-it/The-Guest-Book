import React, { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import Spinner from './components/ui/Spinner';

const Home = lazy(() => import('./pages/Home'));
const CreateEvent = lazy(() => import('./pages/CreateEvent'));
const JoinEvent = lazy(() => import('./pages/JoinEvent'));
const EventRoom = lazy(() => import('./pages/EventRoom'));
const FaceGallery = lazy(() => import('./pages/FaceGallery'));
const CreateReel = lazy(() => import('./pages/CreateReel'));
const CreateStory = lazy(() => import('./pages/CreateStory'));
const MomentEditor = lazy(() => import('./pages/MomentEditor'));

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Spinner size={48} />
    </div>
  );
}

export default function App() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/create" element={<CreateEvent />} />
          <Route path="/join" element={<JoinEvent />} />
          <Route path="/join/:code" element={<JoinEvent />} />
          <Route path="/event/:code" element={<EventRoom />} />
          <Route path="/event/:code/faces" element={<FaceGallery />} />
          <Route path="/event/:code/reel" element={<CreateReel />} />
          <Route path="/event/:code/story" element={<CreateStory />} />
          <Route path="/event/:code/moment" element={<MomentEditor />} />
        </Routes>
      </Suspense>
    </div>
  );
}

import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import CreateGroup from './components/createGroup';
import JoinGroup from './components/joinGroup';
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Play from "./pages/Play";
import ViewGroups from './components/ViewGroups';

export default function App() {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/" element={<Navigate to="/landing" />} />
          <Route path="/landing" element={<Landing />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/groups" element={<CreateGroup />} />
          <Route path="/join" element={<JoinGroup />} />
          <Route path="/play/:groupId" element={<Play />} />
          <Route path='/comp/view/groups' element={< ViewGroups />} />
        </Routes>
      </BrowserRouter>
    )
} 

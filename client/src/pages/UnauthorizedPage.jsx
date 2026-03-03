import { useNavigate } from 'react-router-dom';

const UnauthorizedPage = () => {
    const navigate = useNavigate();

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-white text-center">
            <h1 className="text-4xl font-bold text-red-600">Unauthorized</h1>
            <p className="text-xl text-gray-600 mt-4">You do not have permission to view this page.</p>
            <button onClick={() => navigate(-1)} className="mt-8 px-6 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300">Go Back</button>
        </div>
    );
};
export default UnauthorizedPage;

import { useNavigate } from 'react-router-dom';

const ServerErrorPage = () => {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-white text-center">
            <h1 className="text-4xl font-bold text-red-600">500</h1>
            <p className="text-xl text-gray-600 mt-4">Internal Server Error</p>
            <p className="text-gray-500 mt-2">Please try again later.</p>
        </div>
    );
};
export default ServerErrorPage;

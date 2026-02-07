import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { Folder, ChevronRight, Activity } from 'lucide-react';

const ExecutionDashboard = () => {
    const navigate = useNavigate();
    const [projects, setProjects] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchProjects();
    }, []);

    const fetchProjects = async () => {
        try {
            const res = await api.get('/eps'); // Reusing EPS list for now
            // Flatten and filter for Projects
            const flatten = (nodes: any[]): any[] => {
                let list: any[] = [];
                nodes.forEach(n => {
                    if (n.type === 'PROJECT') list.push(n);
                    if (n.children) list = list.concat(flatten(n.children));
                });
                return list;
            };
            setProjects(flatten(res.data));
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Site Execution</h1>
            <p className="text-gray-500 mb-8">Select a project to enter progress and measurements.</p>

            {loading ? (
                <div className="animate-pulse flex gap-4">
                    <div className="w-64 h-32 bg-gray-200 rounded-lg"></div>
                    <div className="w-64 h-32 bg-gray-200 rounded-lg"></div>
                    <div className="w-64 h-32 bg-gray-200 rounded-lg"></div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {projects.map(project => (
                        <div
                            key={project.id}
                            onClick={() => navigate(`/dashboard/projects/${project.id}/progress`)}
                            className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:border-blue-500 hover:shadow-md transition-all cursor-pointer group"
                        >
                            <div className="flex items-start justify-between mb-4">
                                <div className="p-3 bg-blue-50 rounded-lg text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                    <Folder className="w-6 h-6" />
                                </div>
                                <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-blue-500" />
                            </div>
                            <h3 className="text-lg font-bold text-gray-800 mb-1">{project.name}</h3>
                            <div className="flex items-center text-sm text-gray-500">
                                <Activity className="w-4 h-4 mr-1" />
                                <span>Tap to Enter Progress</span>
                            </div>
                        </div>
                    ))}
                    {projects.length === 0 && (
                        <div className="col-span-3 text-center py-20 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                            <p className="text-gray-500">No Projects found.</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default ExecutionDashboard;

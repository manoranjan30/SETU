import { useEffect, useMemo, useState } from 'react';
import api from '../../../api/axios';
import { qualityService } from '../../../services/quality.service';
import type { QualityFloorStructure } from '../../../types/quality';
import { ChevronRight, ChevronDown, Layers, Wand2, Copy, RefreshCw } from 'lucide-react';

interface EpsNode {
    id: number;
    label?: string;
    nodeName?: string;
    type?: string;
    nodeType?: string;
    children?: EpsNode[];
}

interface Props {
    projectId: number;
}

interface EditableUnit {
    name: string;
    roomsCsv: string;
}

interface RoomDraft {
    name: string;
    roomType: string;
}

const getNodeName = (n: EpsNode) => n.label || n.nodeName || `Node ${n.id}`;
const getNodeType = (n: EpsNode) => n.type || n.nodeType || '';

export default function QualityStructureManager({ projectId }: Props) {
    const [tree, setTree] = useState<EpsNode | null>(null);
    const [selectedNode, setSelectedNode] = useState<EpsNode | null>(null);
    const [loading, setLoading] = useState(false);

    const [floorStructure, setFloorStructure] = useState<QualityFloorStructure | null>(null);

    const [unitCount, setUnitCount] = useState(4);
    const [prefix, setPrefix] = useState('1');
    const [startNumber, setStartNumber] = useState(1);
    const [increment, setIncrement] = useState(1);
    const [pad, setPad] = useState(2);
    const [defaultRooms, setDefaultRooms] = useState('Living,Kitchen,Bedroom 1,Bedroom 2');

    const [previewUnits, setPreviewUnits] = useState<EditableUnit[]>([]);
    const [saving, setSaving] = useState(false);
    const [structureSaving, setStructureSaving] = useState(false);

    const [targetFloorSearch, setTargetFloorSearch] = useState('');
    const [selectedTargetFloorIds, setSelectedTargetFloorIds] = useState<number[]>([]);
    const [collisionMode, setCollisionMode] = useState<'REPLACE' | 'SKIP' | 'FAIL'>('REPLACE');
    const [namingMode, setNamingMode] = useState<'KEEP' | 'FLOOR_PREFIX_REMAP' | 'REPLACE_PREFIX'>('FLOOR_PREFIX_REMAP');
    const [sourcePrefix, setSourcePrefix] = useState('1');
    const [unitDrafts, setUnitDrafts] = useState<Record<number, string>>({});
    const [roomDrafts, setRoomDrafts] = useState<Record<number, RoomDraft>>({});
    const [newRoomDraftByUnit, setNewRoomDraftByUnit] = useState<Record<number, RoomDraft>>({});

    useEffect(() => {
        if (projectId) {
            void fetchProjectTree();
        }
    }, [projectId]);

    useEffect(() => {
        if (selectedNode && getNodeType(selectedNode) === 'FLOOR') {
            void fetchFloorStructure(selectedNode.id);
            const floorNo = extractFirstNumber(getNodeName(selectedNode)) || '1';
            setPrefix(floorNo);
            return;
        }
        setFloorStructure(null);
        setPreviewUnits([]);
    }, [selectedNode, projectId]);

    const allFloors = useMemo(() => flattenFloors(tree), [tree]);
    const filteredTargetFloors = useMemo(() => {
        const sourceId = selectedNode?.id;
        return allFloors
            .filter((f) => f.id !== sourceId)
            .filter((f) =>
                getNodeName(f).toLowerCase().includes(targetFloorSearch.toLowerCase()) ||
                String(f.id).includes(targetFloorSearch),
            );
    }, [allFloors, selectedNode?.id, targetFloorSearch]);

    const copyPreview = useMemo(() => {
        const sourceName = selectedNode ? getNodeName(selectedNode) : '';
        const sourceUnits = floorStructure?.units || [];
        return filteredTargetFloors
            .filter((f) => selectedTargetFloorIds.includes(f.id))
            .map((targetFloor) => ({
                targetFloorId: targetFloor.id,
                targetFloorName: getNodeName(targetFloor),
                sample: sourceUnits.slice(0, 4).map((u) => ({
                    from: u.name,
                    to: mapUnitNameForPreview(
                        u.name,
                        namingMode,
                        sourceName,
                        getNodeName(targetFloor),
                        sourcePrefix,
                    ),
                })),
            }));
    }, [filteredTargetFloors, selectedTargetFloorIds, floorStructure?.units, namingMode, selectedNode, sourcePrefix]);

    const fetchProjectTree = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/eps/${projectId}/tree`);
            if (Array.isArray(res.data) && res.data.length > 0) {
                setTree(res.data[0]);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const fetchFloorStructure = async (floorId: number) => {
        try {
            const data = await qualityService.getFloorStructure(projectId, floorId);
            setFloorStructure(data);
            const nextUnitDrafts: Record<number, string> = {};
            const nextRoomDrafts: Record<number, RoomDraft> = {};
            const nextNewRoomDraftByUnit: Record<number, RoomDraft> = {};
            (data.units || []).forEach((u) => {
                nextUnitDrafts[u.id] = u.name;
                nextNewRoomDraftByUnit[u.id] = { name: '', roomType: '' };
                (u.rooms || []).forEach((r) => {
                    nextRoomDrafts[r.id] = {
                        name: r.name || '',
                        roomType: r.roomType || '',
                    };
                });
            });
            setUnitDrafts(nextUnitDrafts);
            setRoomDrafts(nextRoomDrafts);
            setNewRoomDraftByUnit(nextNewRoomDraftByUnit);
        } catch (err) {
            console.error(err);
            setFloorStructure({ projectId, floorId, units: [] });
        }
    };

    const refreshCurrentFloor = async () => {
        if (!selectedNode || getNodeType(selectedNode) !== 'FLOOR') return;
        await fetchFloorStructure(selectedNode.id);
    };

    const saveUnit = async (unitId: number) => {
        const name = (unitDrafts[unitId] || '').trim();
        if (!name) {
            alert('Unit name is required.');
            return;
        }
        setStructureSaving(true);
        try {
            await qualityService.updateUnit(unitId, { name });
            await refreshCurrentFloor();
        } catch (err) {
            console.error(err);
            alert('Failed to update unit.');
        } finally {
            setStructureSaving(false);
        }
    };

    const removeUnit = async (unitId: number) => {
        if (!confirm('Delete this unit and all its rooms?')) return;
        setStructureSaving(true);
        try {
            await qualityService.deleteUnit(unitId);
            await refreshCurrentFloor();
        } catch (err) {
            console.error(err);
            alert('Failed to delete unit.');
        } finally {
            setStructureSaving(false);
        }
    };

    const saveRoom = async (roomId: number) => {
        const draft = roomDrafts[roomId];
        if (!draft?.name?.trim()) {
            alert('Room name is required.');
            return;
        }
        setStructureSaving(true);
        try {
            await qualityService.updateRoom(roomId, {
                name: draft.name.trim(),
                roomType: draft.roomType.trim() || undefined,
            });
            await refreshCurrentFloor();
        } catch (err) {
            console.error(err);
            alert('Failed to update room.');
        } finally {
            setStructureSaving(false);
        }
    };

    const removeRoom = async (roomId: number) => {
        if (!confirm('Delete this room?')) return;
        setStructureSaving(true);
        try {
            await qualityService.deleteRoom(roomId);
            await refreshCurrentFloor();
        } catch (err) {
            console.error(err);
            alert('Failed to delete room.');
        } finally {
            setStructureSaving(false);
        }
    };

    const addRoom = async (unitId: number) => {
        const draft = newRoomDraftByUnit[unitId] || { name: '', roomType: '' };
        if (!draft.name.trim()) {
            alert('New room name is required.');
            return;
        }
        setStructureSaving(true);
        try {
            await qualityService.createRoom(unitId, {
                name: draft.name.trim(),
                roomType: draft.roomType.trim() || undefined,
            });
            await refreshCurrentFloor();
        } catch (err) {
            console.error(err);
            alert('Failed to add room.');
        } finally {
            setStructureSaving(false);
        }
    };

    const handlePreview = async () => {
        if (!selectedNode || getNodeType(selectedNode) !== 'FLOOR') return;
        try {
            const data = await qualityService.previewBuild(projectId, selectedNode.id, {
                unitCount,
                naming: { prefix, startNumber, increment, pad },
                defaultRooms: defaultRooms
                    .split(',')
                    .map((r) => r.trim())
                    .filter(Boolean)
                    .map((name) => ({ name })),
            });

            const editable: EditableUnit[] = (data.units || []).map((u: any) => ({
                name: u.name,
                roomsCsv: (u.rooms || []).map((r: any) => r.name).join(', '),
            }));
            setPreviewUnits(editable);
        } catch (err) {
            console.error(err);
            alert('Failed to generate preview');
        }
    };

    const handleApply = async () => {
        if (!selectedNode || getNodeType(selectedNode) !== 'FLOOR') return;
        if (previewUnits.length === 0) {
            alert('Generate preview first.');
            return;
        }

        setSaving(true);
        try {
            await qualityService.applyBuild(projectId, selectedNode.id, {
                replaceExisting: true,
                units: previewUnits.map((u) => ({
                    name: u.name.trim(),
                    rooms: u.roomsCsv
                        .split(',')
                        .map((r) => r.trim())
                        .filter(Boolean)
                        .map((name) => ({ name })),
                })),
            });
            setPreviewUnits([]);
            await fetchFloorStructure(selectedNode.id);
            alert('Units and rooms created successfully.');
        } catch (err) {
            console.error(err);
            alert('Failed to apply floor structure.');
        } finally {
            setSaving(false);
        }
    };

    const handleCopy = async () => {
        if (!selectedNode || getNodeType(selectedNode) !== 'FLOOR') return;

        const targetFloorIds = selectedTargetFloorIds.filter((v) => v !== selectedNode.id);

        if (targetFloorIds.length === 0) {
            alert('Select at least one target floor.');
            return;
        }

        try {
            await qualityService.copyStructure({
                sourceFloorId: selectedNode.id,
                targetFloorIds,
                collisionMode,
                naming: {
                    mode: namingMode,
                    sourcePrefix: sourcePrefix || undefined,
                },
            });
            alert('Structure copied successfully.');
        } catch (err) {
            console.error(err);
            alert('Failed to copy structure.');
        }
    };

    return (
        <div className="flex h-[calc(100vh-240px)] bg-white border rounded-xl shadow-sm overflow-hidden">
            <div className="w-1/3 border-r flex flex-col bg-gray-50/50">
                <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                    <h2 className="font-bold text-gray-700 text-sm uppercase tracking-wider">Project Structure</h2>
                    <button onClick={fetchProjectTree} className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1">
                        <RefreshCw className="w-3 h-3" /> Refresh
                    </button>
                </div>
                <div className="p-4 overflow-y-auto flex-1">
                    {loading ? (
                        <p className="text-gray-400 text-sm text-center py-4">Loading structure...</p>
                    ) : tree ? (
                        <TreeNode node={tree} onSelect={setSelectedNode} selectedId={selectedNode?.id} />
                    ) : (
                        <p className="text-gray-400 text-sm text-center py-4">Project not found.</p>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
                {!selectedNode ? (
                    <div className="h-full flex items-center justify-center text-gray-400">
                        Select a floor node to build units and rooms.
                    </div>
                ) : getNodeType(selectedNode) !== 'FLOOR' ? (
                    <div className="h-full flex items-center justify-center text-gray-500">
                        <div className="text-center">
                            <div className="font-semibold">Selected: {getNodeName(selectedNode)} ({getNodeType(selectedNode)})</div>
                            <div className="text-sm mt-2">Please select a FLOOR node to configure units and rooms.</div>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900">Quality Floor Builder</h2>
                                <p className="text-sm text-gray-500 mt-1">{getNodeName(selectedNode)} (ID: {selectedNode.id})</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="border border-gray-200 rounded-xl p-4 bg-white">
                                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2 text-sm uppercase tracking-wider">
                                    <Wand2 className="w-4 h-4 text-indigo-500" /> Build Units (Per Floor)
                                </h3>

                                <div className="grid grid-cols-2 gap-3">
                                    <Field label="No. of Units">
                                        <input type="number" min={1} value={unitCount} onChange={(e) => setUnitCount(Number(e.target.value))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                                    </Field>
                                    <Field label="Prefix">
                                        <input value={prefix} onChange={(e) => setPrefix(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="e.g. 1" />
                                    </Field>
                                    <Field label="Start Number">
                                        <input type="number" value={startNumber} onChange={(e) => setStartNumber(Number(e.target.value))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                                    </Field>
                                    <Field label="Increment">
                                        <input type="number" value={increment} onChange={(e) => setIncrement(Number(e.target.value))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                                    </Field>
                                    <Field label="Pad Digits">
                                        <input type="number" min={0} value={pad} onChange={(e) => setPad(Number(e.target.value))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                                    </Field>
                                </div>

                                <div className="mt-3">
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Default Rooms (comma separated)</label>
                                    <textarea value={defaultRooms} onChange={(e) => setDefaultRooms(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm h-20" />
                                </div>

                                <div className="mt-4 flex gap-2">
                                    <button onClick={handlePreview} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700">Generate Preview</button>
                                    <button onClick={handleApply} disabled={saving || previewUnits.length === 0} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-50">{saving ? 'Applying...' : 'Create Units & Rooms'}</button>
                                </div>
                            </div>

                            <div className="border border-gray-200 rounded-xl p-4 bg-white">
                                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2 text-sm uppercase tracking-wider">
                                    <Copy className="w-4 h-4 text-indigo-500" /> Copy To Other Floors
                                </h3>

                                <Field label="Find Floors">
                                    <input
                                        value={targetFloorSearch}
                                        onChange={(e) => setTargetFloorSearch(e.target.value)}
                                        placeholder="Search by floor name or id"
                                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                                    />
                                </Field>

                                <div className="text-xs text-gray-500 mb-2 flex gap-2">
                                    <button
                                        type="button"
                                        className="underline"
                                        onClick={() => setSelectedTargetFloorIds(filteredTargetFloors.map((f) => f.id))}
                                    >
                                        Select all filtered
                                    </button>
                                    <button
                                        type="button"
                                        className="underline"
                                        onClick={() => setSelectedTargetFloorIds([])}
                                    >
                                        Clear
                                    </button>
                                </div>
                                <div className="max-h-36 overflow-auto border border-gray-200 rounded-lg p-2 space-y-1 mb-3">
                                    {filteredTargetFloors.map((f) => (
                                        <label key={f.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 p-1 rounded">
                                            <input
                                                type="checkbox"
                                                checked={selectedTargetFloorIds.includes(f.id)}
                                                onChange={(e) => {
                                                    setSelectedTargetFloorIds((prev) =>
                                                        e.target.checked ? [...prev, f.id] : prev.filter((id) => id !== f.id),
                                                    );
                                                }}
                                            />
                                            <span>{getNodeName(f)} (#{f.id})</span>
                                        </label>
                                    ))}
                                    {filteredTargetFloors.length === 0 && (
                                        <div className="text-xs text-gray-400 p-1">No floors found.</div>
                                    )}
                                </div>

                                <Field label="Naming Mode">
                                    <select value={namingMode} onChange={(e) => setNamingMode(e.target.value as any)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                                        <option value="FLOOR_PREFIX_REMAP">Floor Prefix Remap (101 -&gt; 201)</option>
                                        <option value="KEEP">Keep Same Unit Names</option>
                                        <option value="REPLACE_PREFIX">Replace Prefix</option>
                                    </select>
                                </Field>

                                {namingMode === 'REPLACE_PREFIX' && (
                                    <Field label="Source Prefix">
                                        <input value={sourcePrefix} onChange={(e) => setSourcePrefix(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                                    </Field>
                                )}

                                <Field label="Collision Mode">
                                    <select value={collisionMode} onChange={(e) => setCollisionMode(e.target.value as any)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                                        <option value="REPLACE">Replace existing target structure</option>
                                        <option value="SKIP">Skip floors with existing structure</option>
                                        <option value="FAIL">Fail if target has existing structure</option>
                                    </select>
                                </Field>

                                <button onClick={handleCopy} className="mt-3 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700">Copy Structure</button>
                            </div>
                        </div>

                        {copyPreview.length > 0 && (
                            <div className="border border-gray-200 rounded-xl p-4 bg-white">
                                <h3 className="font-bold text-gray-800 mb-3 text-sm uppercase tracking-wider">Copy Preview</h3>
                                <div className="space-y-3">
                                    {copyPreview.map((row) => (
                                        <div key={row.targetFloorId} className="border border-gray-100 rounded-lg p-3">
                                            <div className="text-sm font-semibold text-gray-900 mb-2">
                                                Target: {row.targetFloorName} (#{row.targetFloorId})
                                            </div>
                                            <div className="text-xs text-gray-600 space-y-1">
                                                {row.sample.map((s, idx) => (
                                                    <div key={idx}>{s.from} -&gt; {s.to}</div>
                                                ))}
                                                {(floorStructure?.units?.length || 0) > 4 && (
                                                    <div className="text-gray-400">... and more units</div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {previewUnits.length > 0 && (
                            <div className="border border-gray-200 rounded-xl p-4 bg-white">
                                <h3 className="font-bold text-gray-800 mb-3 text-sm uppercase tracking-wider">Preview (Editable)</h3>
                                <div className="space-y-2 max-h-64 overflow-auto">
                                    {previewUnits.map((u, idx) => (
                                        <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                                            <div className="col-span-3">
                                                <input value={u.name} onChange={(e) => setPreviewUnits((prev) => prev.map((item, i) => i === idx ? { ...item, name: e.target.value } : item))} className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm" />
                                            </div>
                                            <div className="col-span-9">
                                                <input value={u.roomsCsv} onChange={(e) => setPreviewUnits((prev) => prev.map((item, i) => i === idx ? { ...item, roomsCsv: e.target.value } : item))} className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="border border-gray-200 rounded-xl p-4 bg-white">
                            <h3 className="font-bold text-gray-800 mb-3 text-sm uppercase tracking-wider">Current Floor Structure</h3>
                            {(floorStructure?.units?.length || 0) === 0 ? (
                                <div className="text-sm text-gray-400">No units/rooms configured.</div>
                            ) : (
                                <div className="space-y-2">
                                    {floorStructure?.units.map((u) => (
                                        <div key={u.id} className="p-3 border border-gray-100 rounded-lg">
                                            <div className="flex items-center gap-2">
                                                <input
                                                    value={unitDrafts[u.id] ?? u.name}
                                                    onChange={(e) =>
                                                        setUnitDrafts((prev) => ({ ...prev, [u.id]: e.target.value }))
                                                    }
                                                    className="border border-gray-200 rounded px-2 py-1 text-sm font-medium text-gray-900 flex-1"
                                                />
                                                <button
                                                    onClick={() => saveUnit(u.id)}
                                                    disabled={structureSaving}
                                                    className="px-2 py-1 text-xs rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                                                >
                                                    Save Unit
                                                </button>
                                                <button
                                                    onClick={() => removeUnit(u.id)}
                                                    disabled={structureSaving}
                                                    className="px-2 py-1 text-xs rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                                                >
                                                    Delete Unit
                                                </button>
                                            </div>

                                            <div className="mt-3 space-y-2">
                                                {u.rooms.map((r) => (
                                                    <div key={r.id} className="grid grid-cols-12 gap-2 items-center">
                                                        <input
                                                            value={roomDrafts[r.id]?.name ?? r.name}
                                                            onChange={(e) =>
                                                                setRoomDrafts((prev) => ({
                                                                    ...prev,
                                                                    [r.id]: {
                                                                        ...(prev[r.id] || { roomType: r.roomType || '' }),
                                                                        name: e.target.value,
                                                                    },
                                                                }))
                                                            }
                                                            className="col-span-5 border border-gray-200 rounded px-2 py-1 text-sm"
                                                            placeholder="Room name"
                                                        />
                                                        <input
                                                            value={roomDrafts[r.id]?.roomType ?? (r.roomType || '')}
                                                            onChange={(e) =>
                                                                setRoomDrafts((prev) => ({
                                                                    ...prev,
                                                                    [r.id]: {
                                                                        ...(prev[r.id] || { name: r.name }),
                                                                        roomType: e.target.value,
                                                                    },
                                                                }))
                                                            }
                                                            className="col-span-3 border border-gray-200 rounded px-2 py-1 text-sm"
                                                            placeholder="Room type"
                                                        />
                                                        <button
                                                            onClick={() => saveRoom(r.id)}
                                                            disabled={structureSaving}
                                                            className="col-span-2 px-2 py-1 text-xs rounded bg-slate-700 text-white hover:bg-slate-800 disabled:opacity-50"
                                                        >
                                                            Save
                                                        </button>
                                                        <button
                                                            onClick={() => removeRoom(r.id)}
                                                            disabled={structureSaving}
                                                            className="col-span-2 px-2 py-1 text-xs rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                                                        >
                                                            Delete
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>

                                            <div className="mt-3 grid grid-cols-12 gap-2 items-center">
                                                <input
                                                    value={newRoomDraftByUnit[u.id]?.name || ''}
                                                    onChange={(e) =>
                                                        setNewRoomDraftByUnit((prev) => ({
                                                            ...prev,
                                                            [u.id]: { ...(prev[u.id] || { roomType: '' }), name: e.target.value },
                                                        }))
                                                    }
                                                    className="col-span-5 border border-gray-200 rounded px-2 py-1 text-sm"
                                                    placeholder="New room name"
                                                />
                                                <input
                                                    value={newRoomDraftByUnit[u.id]?.roomType || ''}
                                                    onChange={(e) =>
                                                        setNewRoomDraftByUnit((prev) => ({
                                                            ...prev,
                                                            [u.id]: { ...(prev[u.id] || { name: '' }), roomType: e.target.value },
                                                        }))
                                                    }
                                                    className="col-span-3 border border-gray-200 rounded px-2 py-1 text-sm"
                                                    placeholder="Room type"
                                                />
                                                <button
                                                    onClick={() => addRoom(u.id)}
                                                    disabled={structureSaving}
                                                    className="col-span-4 px-2 py-1 text-xs rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                                                >
                                                    Add Room
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="mb-3">
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{label}</label>
            {children}
        </div>
    );
}

function flattenFloors(root: EpsNode | null): EpsNode[] {
    if (!root) return [];
    const out: EpsNode[] = [];
    const stack: EpsNode[] = [root];
    while (stack.length > 0) {
        const cur = stack.pop()!;
        if (getNodeType(cur) === 'FLOOR') out.push(cur);
        for (const child of cur.children || []) stack.push(child);
    }
    return out;
}

function extractFirstNumber(text: string): string | null {
    const m = text.match(/\d+/);
    return m?.[0] || null;
}

function mapUnitNameForPreview(
    sourceUnitName: string,
    mode: 'KEEP' | 'FLOOR_PREFIX_REMAP' | 'REPLACE_PREFIX',
    sourceFloorName: string,
    targetFloorName: string,
    sourcePrefix?: string,
): string {
    if (mode === 'KEEP') return sourceUnitName;

    if (mode === 'REPLACE_PREFIX' && sourcePrefix) {
        const targetFloorPrefix = extractFirstNumber(targetFloorName);
        if (!targetFloorPrefix) return sourceUnitName;
        if (sourceUnitName.startsWith(sourcePrefix)) {
            return `${targetFloorPrefix}${sourceUnitName.slice(sourcePrefix.length)}`;
        }
        return sourceUnitName;
    }

    if (/^\d+$/.test(sourceUnitName)) {
        const sourceFloorNo = extractFirstNumber(sourceFloorName);
        const targetFloorNo = extractFirstNumber(targetFloorName);
        if (!sourceFloorNo || !targetFloorNo) return sourceUnitName;
        if (sourceUnitName.startsWith(sourceFloorNo)) {
            return `${targetFloorNo}${sourceUnitName.slice(sourceFloorNo.length)}`;
        }
    }

    return sourceUnitName;
}

function TreeNode({ node, onSelect, selectedId }: { node: EpsNode, onSelect: (n: EpsNode) => void, selectedId?: number }) {
    const [expanded, setExpanded] = useState(false);
    const hasChildren = node.children && node.children.length > 0;

    useEffect(() => {
        const type = getNodeType(node);
        if (type === 'PROJECT' || type === 'BLOCK' || type === 'TOWER') {
            setExpanded(true);
        }
    }, [node]);

    return (
        <div className="ml-3 select-none">
            <div
                className={`flex items-center cursor-pointer p-1.5 rounded-lg transition-all ${selectedId === node.id ? 'bg-blue-50 text-blue-700 font-medium' : 'hover:bg-gray-100 text-gray-600'}`}
                onClick={() => { onSelect(node); if (hasChildren) setExpanded(!expanded); }}
            >
                <button
                    onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
                    className={`mr-1 p-0.5 rounded hover:bg-black/5 ${hasChildren ? 'text-gray-400' : 'invisible'}`}
                >
                    {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
                <Layers className="w-3.5 h-3.5 mr-1" />
                <span className="truncate text-sm">{getNodeName(node)} ({getNodeType(node)})</span>
            </div>
            {expanded && hasChildren && (
                <div className="ml-2 border-l border-gray-200 pl-1">
                    {node.children!.map(c => <TreeNode key={c.id} node={c} onSelect={onSelect} selectedId={selectedId} />)}
                </div>
            )}
        </div>
    );
}

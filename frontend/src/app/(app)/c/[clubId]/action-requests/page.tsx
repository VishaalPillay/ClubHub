"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useClub } from "@/features/club/ClubProvider";
import { approveActionRequest, listActionRequests, rejectActionRequest } from "@/lib/api/requests";
import { isSecPlus } from "@/lib/roles";

export default function ActionRequestsPage() {
  const { clubId, currentRole } = useClub();
  const router = useRouter();
  const queryClient = useQueryClient();

  const canReview = isSecPlus(currentRole);

  useEffect(() => {
    if (!canReview) router.push(`/c/${clubId}/dashboard`);
  }, [canReview, clubId, router]);

  const { data: requests = [], isPending: loading } = useQuery({
    queryKey: ["club", clubId, "action-requests"],
    queryFn: () => listActionRequests(clubId),
    enabled: canReview,
  });

  const refetch = () => {
    queryClient.invalidateQueries({ queryKey: ["club", clubId, "action-requests"] });
    queryClient.invalidateQueries({ queryKey: ["club", clubId, "members"] });
  };

  const handleApprove = async (reqId: number) => {
    try {
      await approveActionRequest(clubId, reqId);
      refetch();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed to approve.");
    }
  };

  const handleReject = async (reqId: number) => {
    try {
      await rejectActionRequest(clubId, reqId);
      refetch();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed to reject.");
    }
  };

  if (loading || !canReview) return null;

  return (
    <div className="w-full max-w-5xl mx-auto">
      <div className="mb-8 border-b-2 border-black pb-4 flex justify-between items-end">
        <div>
          <h1 className="font-display text-5xl font-black tracking-tighter uppercase">Action Requests</h1>
          <div className="font-ui text-lg text-[#757575] mt-2">Manage member elevation and removal requests from Leads.</div>
        </div>
        <button onClick={() => router.push(`/c/${clubId}/dashboard`)} className="font-ui text-sm font-bold uppercase border-2 border-black px-4 py-2 hover:bg-black hover:text-white transition-none">
          Back to Dashboard
        </button>
      </div>

      <div className="flex flex-col gap-4">
        {requests.length === 0 ? (
          <div className="border-2 border-black p-12 text-center">
            <span className="material-symbols-outlined text-4xl text-[#757575] mb-2">inbox</span>
            <div className="font-mono text-sm uppercase tracking-widest text-[#757575]">No pending action requests</div>
          </div>
        ) : (
          requests.map(req => (
            <div key={req.id} className="border-2 border-black p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white group">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <span className="font-display text-2xl font-bold uppercase">{req.target_name}</span>
                  <span className={`font-mono text-[10px] uppercase text-white px-2 py-0.5 tracking-widest ${req.action_type === 'kick' ? 'bg-red-600' : 'bg-[#057DBC]'}`}>
                    {req.action_type}
                  </span>
                  {req.action_type === 'promote' && (
                    <span className="font-mono text-[10px] uppercase bg-black text-white px-2 py-0.5 tracking-widest">
                      To: {req.new_role}
                    </span>
                  )}
                </div>
                <div className="font-mono text-xs text-[#757575] uppercase">
                  Requested by <span className="text-black font-bold">{req.requester_name}</span> on {new Date(req.created_at).toLocaleDateString()}
                </div>
                {req.reason && (
                  <div className="mt-2 font-ui text-sm text-[#4c4546] border-l-2 border-[#e2e8f0] pl-3 py-1">
                    &quot;{req.reason}&quot;
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleReject(req.id)}
                  className="border-2 border-black font-ui text-sm font-bold uppercase px-6 py-2 hover:bg-red-600 hover:border-red-600 hover:text-white transition-none"
                >
                  Reject
                </button>
                <button
                  onClick={() => handleApprove(req.id)}
                  className="border-2 border-[#057DBC] bg-[#057DBC] text-white font-ui text-sm font-bold uppercase px-6 py-2 hover:bg-black hover:border-black transition-none"
                >
                  Approve
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

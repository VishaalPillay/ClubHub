"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useClub } from "@/features/club/ClubProvider";
import { approveJoinRequest, listJoinRequests, rejectJoinRequest } from "@/lib/api/requests";
import { isSecPlus } from "@/lib/roles";

export default function JoinRequestsPage() {
  const { clubId, currentRole } = useClub();
  const router = useRouter();
  const queryClient = useQueryClient();

  const canReview = isSecPlus(currentRole);

  useEffect(() => {
    if (!canReview) router.push(`/c/${clubId}/dashboard`);
  }, [canReview, clubId, router]);

  const { data: requests = [], isPending: loading } = useQuery({
    queryKey: ["club", clubId, "join-requests"],
    queryFn: () => listJoinRequests(clubId),
    enabled: canReview,
  });

  const refetch = () => {
    queryClient.invalidateQueries({ queryKey: ["club", clubId, "join-requests"] });
    queryClient.invalidateQueries({ queryKey: ["club", clubId, "members"] });
  };

  const handleApprove = async (reqId: number) => {
    try {
      await approveJoinRequest(clubId, reqId);
      refetch();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed to approve.");
    }
  };

  const handleReject = async (reqId: number) => {
    try {
      await rejectJoinRequest(clubId, reqId);
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
          <h1 className="font-display text-5xl font-black tracking-tighter uppercase">Join Requests</h1>
          <div className="font-ui text-lg text-[#757575] mt-2">Manage pending access requests for your club.</div>
        </div>
        <button onClick={() => router.push(`/c/${clubId}/dashboard`)} className="font-ui text-sm font-bold uppercase border-2 border-black px-4 py-2 hover:bg-black hover:text-white transition-none">
          Back to Dashboard
        </button>
      </div>

      <div className="flex flex-col gap-4">
        {requests.length === 0 ? (
          <div className="border-2 border-black p-12 text-center">
            <span className="material-symbols-outlined text-4xl text-[#757575] mb-2">inbox</span>
            <div className="font-mono text-sm uppercase tracking-widest text-[#757575]">No pending requests</div>
          </div>
        ) : (
          requests.map(req => (
            <div key={req.id} className="border-2 border-black p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <span className="font-display text-2xl font-bold uppercase">{req.user_name}</span>
                  <span className="font-mono text-[10px] uppercase bg-black text-white px-2 py-0.5 tracking-widest">
                    {req.requested_role}
                  </span>
                  {req.requested_domain_id && (
                    <span className="font-mono text-[10px] uppercase bg-[#f3f3f3] border border-black text-black px-2 py-0.5 tracking-widest">
                      {req.requested_domain_name || `Domain ${req.requested_domain_id}`}
                    </span>
                  )}
                </div>
                {req.message && (
                  <div className="font-ui text-sm text-[#4c4546] mb-1 italic border-l-2 border-[#057DBC] pl-2">
                    &quot;{req.message}&quot;
                  </div>
                )}
                <div className="font-mono text-xs text-[#757575] uppercase">
                  Requested on {new Date(req.created_at).toLocaleDateString()}
                </div>
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

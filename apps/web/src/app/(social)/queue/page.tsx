import ApprovalQueue from "@/components/ApprovalQueue";
import PageHeader from "@/components/layout/PageHeader";

export default function QueuePage() {
  return (
    <div className="p-8">
      <PageHeader title="Approval Queue" description="Review, approve, and schedule content drafts" />
      <ApprovalQueue />
    </div>
  );
}

import CalendarView from "@/components/CalendarView";
import PageHeader from "@/components/layout/PageHeader";

export default function CalendarPage() {
  return (
    <div className="p-8">
      <PageHeader title="Content Calendar" description="View scheduled posts by date" />
      <CalendarView />
    </div>
  );
}

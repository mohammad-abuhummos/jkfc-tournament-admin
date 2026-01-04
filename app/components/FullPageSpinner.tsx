export function FullPageSpinner({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="text-sm text-gray-600">{label}</div>
    </div>
  );
}



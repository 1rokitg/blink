export default function InternalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="monetise min-h-screen bg-[#0a0a0a] text-[#fafafa] antialiased">
      {children}
    </div>
  );
}

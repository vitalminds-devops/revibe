/** Numbered heading shared by the page's sections, so the workflow reads top to bottom. */
export function SectionHeading({
  step,
  title,
  description,
  children,
}: {
  step: number;
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="section-heading">
      <div>
        <div className="eyebrow no-print">
          <span />
          STEP {step}
        </div>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {children && <div className="section-actions no-print">{children}</div>}
    </div>
  );
}

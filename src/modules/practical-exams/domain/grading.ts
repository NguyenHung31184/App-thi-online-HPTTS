/** The next criterion added to a template: "Tiêu chí n", 10 points, weight 1, at the end. */
export function newCriterionInput(templateId: string, existingCount: number) {
  return {
    template_id: templateId,
    order_index: existingCount,
    name: `Tiêu chí ${existingCount + 1}`,
    max_score: 10,
    weight: 1,
  };
}

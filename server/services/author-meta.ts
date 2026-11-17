/** SQL parçası: verilen kullanıcı sütunu için onaylı rozetler (json) ve itibar toplamı. */
export function authorMetaSql(userColumn: string) {
  return `(SELECT COALESCE(json_agg(json_build_object('claim',vr.claim,'method',vr.method,'university',un.name,'program',pr.name) ORDER BY vr.reviewed_at),'[]'::json)
     FROM verification_requests vr JOIN universities un ON un.id=vr.university_id LEFT JOIN programs pr ON pr.id=vr.program_id
     WHERE vr.user_id=${userColumn} AND vr.status='approved') AS author_badges,
    (SELECT COALESCE(sum(re.delta),0)::int FROM reputation_events re WHERE re.user_id=${userColumn}) AS author_reputation`;
}

import { useEffect, useState } from "react";
import { apiRequest } from "../api.js";

export default function AdminPage() {
  const [users, setUsers] = useState([]);
  const [editedRoles, setEditedRoles] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingById, setIsSavingById] = useState({});
  const [error, setError] = useState("");
  const [statusCode, setStatusCode] = useState(null);

  useEffect(() => {
    apiRequest("/admin/users", {
      requireAuth: true,
    })
      .then((result) => {
        setUsers(result.users || []);
        setEditedRoles(
          Object.fromEntries((result.users || []).map((user) => [user.id, user.role || ""]))
        );
      })
      .catch((requestError) => {
        setError(requestError.message);
        setStatusCode(requestError.status || null);
      })
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return (
      <section className="hero">
        <h1>Admin</h1>
        <p>Loading users...</p>
      </section>
    );
  }

  if (statusCode === 401) {
    return (
      <section className="hero">
        <h1>Admin</h1>
        <p className="error">401 Unauthorized: You must be logged in.</p>
      </section>
    );
  }

  if (statusCode === 403) {
    return (
      <section className="hero">
        <h1>Admin</h1>
        <p className="error">403 Forbidden: Admin role required.</p>
      </section>
    );
  }

  async function saveRole(userId) {
    const roleValue = String(editedRoles[userId] || "").trim();
    if (!roleValue) {
      setError("Role cannot be empty.");
      return;
    }

    setError("");
    setIsSavingById((state) => ({ ...state, [userId]: true }));
    try {
      const result = await apiRequest(`/admin/users/${userId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        requireAuth: true,
        body: JSON.stringify({ role: roleValue }),
      });

      setUsers((current) =>
        current.map((user) => (user.id === userId ? { ...user, role: result.role } : user))
      );
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setIsSavingById((state) => ({ ...state, [userId]: false }));
    }
  }

  async function deleteUser(user) {
    const confirmed = window.confirm(`Delete user "${user.username}"? This cannot be undone.`);
    if (!confirmed) {
      return;
    }

    setError("");
    setIsSavingById((state) => ({ ...state, [user.id]: true }));
    try {
      await apiRequest(`/admin/users/${user.id}`, {
        method: "DELETE",
        requireAuth: true,
      });

      setUsers((current) => current.filter((item) => item.id !== user.id));
      setEditedRoles((state) => {
        const next = { ...state };
        delete next[user.id];
        return next;
      });
    } catch (deleteError) {
      setError(deleteError.message);
    } finally {
      setIsSavingById((state) => ({ ...state, [user.id]: false }));
    }
  }

  return (
    <section className="detail-page">
      <header className="detail-header">
        <h1>Admin</h1>
        <p>User management</p>
      </header>

      {error ? <p className="error-toast">{error}</p> : null}

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Username</th>
              <th>Role</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>{user.id}</td>
                <td>{user.username}</td>
                <td>
                  <input
                    type="text"
                    value={editedRoles[user.id] ?? ""}
                    onChange={(event) =>
                      setEditedRoles((state) => ({ ...state, [user.id]: event.target.value }))
                    }
                  />
                </td>
                <td className="admin-actions">
                  <button
                    className="button button-secondary"
                    type="button"
                    onClick={() => saveRole(user.id)}
                    disabled={!!isSavingById[user.id]}
                  >
                    Save
                  </button>
                  <button
                    className="button button-danger"
                    type="button"
                    onClick={() => deleteUser(user)}
                    disabled={!!isSavingById[user.id]}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

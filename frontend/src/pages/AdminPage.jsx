import { useEffect, useState } from "react";
import { AUTH_TOKEN_KEY, apiRequest } from "../api.js";

export default function AdminPage() {
  const [users, setUsers] = useState([]);
  const [editedRoles, setEditedRoles] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingById, setIsSavingById] = useState({});
  const [error, setError] = useState("");
  const [statusCode, setStatusCode] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    apiRequest("/admin/users", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
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
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
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
          Authorization: `Bearer ${token}`,
        },
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

    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    setError("");
    setIsSavingById((state) => ({ ...state, [user.id]: true }));
    try {
      await apiRequest(`/admin/users/${user.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
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

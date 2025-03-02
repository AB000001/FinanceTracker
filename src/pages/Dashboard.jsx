import React, { useEffect, useState } from "react";
import { Card, Row } from "antd";
import { Line, Pie } from "@ant-design/plots";
import moment from "moment";
import TransactionSearch from "../components/TransactionSearch";
import AddIncomeModal from "../components/Modals/AddIncome";
import AddExpenseModal from "../components/Modals/AddExpense";
import Cards from "../components/Cards";
import NoTransactions from "../components/NoTransactions";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth, db } from "../firebase";
import { addDoc, collection, getDocs, query } from "firebase/firestore";
import Loader from "../components/Loader/Loader.jsx";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import { unparse } from "papaparse";
import Header from "../components/header.jsx";
import '../App.css';
//import { doc, updateDoc } from "firebase/firestore";

const Dashboard = () => {
  const [user] = useAuthState(auth);
  const [isExpenseModalVisible, setIsExpenseModalVisible] = useState(false);
  const [isIncomeModalVisible, setIsIncomeModalVisible] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentBalance, setCurrentBalance] = useState(0);
  const [income, setIncome] = useState(0);
  const [expenses, setExpenses] = useState(0);

  const navigate = useNavigate();

  const processChartData = () => {
    const balanceData = [];
    const spendingData = {};

    transactions.forEach((transaction) => {
      const monthYear = moment(transaction.date).format("MMM YYYY");
      const tag = transaction.tag;

      if (transaction.type === "income") {
        if (balanceData.some((data) => data.month === monthYear)) {
          balanceData.find((data) => data.month === monthYear).balance +=
            transaction.amount;
        } else {
          balanceData.push({ month: monthYear, balance: transaction.amount });
        }
      } else {
        if (balanceData.some((data) => data.month === monthYear)) {
          balanceData.find((data) => data.month === monthYear).balance -=
            transaction.amount;
        } else {
          balanceData.push({ month: monthYear, balance: -transaction.amount });
        }

        if (spendingData[tag]) {
          spendingData[tag] += transaction.amount;
        } else {
          spendingData[tag] = transaction.amount;
        }
      }
    });

    const spendingDataArray = Object.keys(spendingData).map((key) => ({
      category: key,
      value: spendingData[key],
    }));

    return { balanceData, spendingDataArray };
  };

  const { balanceData, spendingDataArray } = processChartData();
  const showExpenseModal = () => {
    setIsExpenseModalVisible(true);
  };

  const showIncomeModal = () => {
    setIsIncomeModalVisible(true);
  };

  const handleExpenseCancel = () => {
    setIsExpenseModalVisible(false);
  };

  const handleIncomeCancel = () => {
    setIsIncomeModalVisible(false);
  };

  useEffect(() => {
    if (user) {
      fetchTransactions();
    }
  }, [user]);

  const onFinish = (values, type) => {
    const newTransaction = {
      type: type,
      date: moment(values.date).format("YYYY-MM-DD"),
      amount: parseFloat(values.amount),
      tag: values.tag,
      name: values.name,
    };

    setTransactions([...transactions, newTransaction]);
    setIsExpenseModalVisible(false);
    setIsIncomeModalVisible(false);
    addTransaction(newTransaction);
    calculateBalance();
  };

  const calculateBalance = () => {
    let incomeTotal = 0;
    let expensesTotal = 0;

    transactions.forEach((transaction) => {
      if (transaction.type === "income") {
        incomeTotal += transaction.amount;
      } else {
        expensesTotal += transaction.amount;
      }
    });

    setIncome(incomeTotal);
    setExpenses(expensesTotal);
    setCurrentBalance(incomeTotal - expensesTotal);
  };

  // Calculate the initial balance, income, and expenses
  useEffect(() => {
    calculateBalance();
  }, [transactions]);

  async function addTransaction(transaction, many) {

    if (!user || !user.uid) {
      toast.error("User is not authenticated");
      return;
    }
    try {
      const docRef = await addDoc(
        collection(db, `users/${user.uid}/transactions`),
        transaction
      );
      console.log("Document written with ID: ", docRef.id);
      if (!many) {
        toast.success("Transaction Added!");
      }
    } catch (e) {
      console.error("Error adding document: ", e);
      if (!many) {
        toast.error("Couldn't add transaction");
      }
    }
  }

  
  
  async function fetchTransactions() {
    setLoading(true);
    if (user) {
      try {
        const q = query(collection(db, `users/${user.uid}/transactions`));
        const querySnapshot = await getDocs(q);
        let transactionsArray = [];
        querySnapshot.forEach((doc) => {
          transactionsArray.push(doc.data());
        });
        setTransactions(transactionsArray);
        toast.success("Transactions Fetched!");
      } catch (error) {
        console.error("Error fetching transactions:", error);
        toast.error("Error fetching transactions.");
      }
    }
    setLoading(false);
  }
  

  /*async function fetchTransactions() {
    setLoading(true);
    if (user) {
      const q = query(collection(db, `users/${user.uid}/transactions`));
      const querySnapshot = await getDocs(q);
      let transactionsArray = [];
      querySnapshot.forEach((doc) => {
        // Include the document ID in the transaction object
        transactionsArray.push({ id: doc.id, ...doc.data() });
      });
      setTransactions(transactionsArray);
      toast.success("Transactions Fetched!");
    }
    setLoading(false);
  }*/


  const balanceConfig = {
    data: balanceData,
    xField: "month",
    yField: "balance",
  };

  const spendingConfig = {
    data: spendingDataArray,
    angleField: "value",
    colorField: "category",
  };

  function reset() {
    console.log("resetting");
  }
  const cardStyle = {
    boxShadow: "0px 0px 30px 8px rgba(227, 227, 227, 0.75)",
    margin: "2rem",
    borderRadius: "0.5rem",
    minWidth: "400px",
    flex: 1,
  };

  function exportToCsv() {
    const csv = unparse(transactions, {
      fields: ["name", "type", "date", "amount", "tag"],
    });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "transactions.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /*async function updateTransaction(transaction) {
    try {
      // Check if the transaction has an id field
      if (!transaction.id) {
        throw new Error("Transaction ID is missing.");
      }
  
      const transactionRef = doc(db, `users/${user.uid}/transactions`, transaction.id);  // Get the transaction doc by ID
      await updateDoc(transactionRef, transaction);  // Update the transaction in Firestore
      toast.success("Transaction updated!");
    } catch (error) {
      console.error("Error updating transaction:", error);
      toast.error("Error updating transaction.");
    }
  }*/

  return (
    <div>
      <Header />
      <div className="dashboard-container">
        {loading ? (
          <Loader />
        ) : (
          <>
            <Cards
              currentBalance={currentBalance}
              income={income}
              expenses={expenses}
              showExpenseModal={showExpenseModal}
              showIncomeModal={showIncomeModal}
              cardStyle={cardStyle}
              reset={reset}
            />

            <AddExpenseModal
              isExpenseModalVisible={isExpenseModalVisible}
              handleExpenseCancel={handleExpenseCancel}
              onFinish={onFinish}
            />
            <AddIncomeModal
              isIncomeModalVisible={isIncomeModalVisible}
              handleIncomeCancel={handleIncomeCancel}
              onFinish={onFinish}
            />
            {transactions.length === 0 ? (
              <NoTransactions />
            ) : (
              <>
                <Row gutter={16}>
                  <Card variant={true} style={cardStyle}>
                    <h2>Financial Statistics</h2>
                    <Line {...{ ...balanceConfig, data: balanceData }} />
                  </Card>

                  <Card variant={true} style={{ ...cardStyle, flex: 0.45 }}>
                    <h2>Total Spending</h2>
                    {spendingDataArray.length == 0 ? (
                      <p>Seems like you haven't spent anything till now...</p>
                    ) : (
                      <Pie {...{ ...spendingConfig, data: spendingDataArray }} />
                    )}
                  </Card>
                </Row>
              </>
            )}
            <div id="transaction-history">
              <TransactionSearch
                transactions={transactions}
                exportToCsv={exportToCsv}
                fetchTransactions={fetchTransactions}
                addTransaction={addTransaction}
              //updateTransaction={updateTransaction}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
